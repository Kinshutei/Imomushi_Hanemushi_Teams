import { useState } from 'react'
import { StreamingRecord } from '../types'
import { extractYtVideoId } from '../utils/csv'

interface Props {
  records: StreamingRecord[]
}

export default function StreamsTab({ records }: Props) {
  const [defaultOpen, setDefaultOpen] = useState(false)
  const [mountKey, setMountKey] = useState(0)
  const [query, setQuery] = useState('')

  if (records.length === 0) {
    return <p style={{ color: '#888', padding: '1rem' }}>配信枠がまだ登録されていません。</p>
  }

  const trimmedQuery = query.trim()
  const isSearching = trimmedQuery.length > 0

  // 枠単位に集約（日付降順）
  const streams = Array.from(
    new Map(
      records
        .sort((a, b) => b.配信日.localeCompare(a.配信日))
        .map((r) => [`${r.枠名}__${r.配信日}`, { 枠名: r.枠名, 配信日: r.配信日, 枠URL: r.枠URL }])
    ).values()
  )

  // 検索時：ヒットした枠のみ表示
  const filteredStreams = isSearching
    ? streams.filter((stream) =>
        records
          .filter((r) => r.枠名 === stream.枠名)
          .some((r) => r.楽曲名.toLowerCase().includes(trimmedQuery.toLowerCase()))
      )
    : streams

  return (
    <div>
      {/* 検索フォーム + 展開/折りたたみボタン */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%', maxWidth: '360px' }}>
          <span style={{ position: 'absolute', left: '10px', color: '#606060', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="曲名で検索..."
            style={{
              width: '100%',
              padding: '7px 36px 7px 32px',
              border: '1px solid #2e2e2e',
              borderRadius: '20px',
              fontFamily: 'inherit',
              fontSize: '15px',
              outline: 'none',
              background: '#1c1c1c',
              color: '#e8e8e8',
              boxShadow: isSearching ? '0 0 0 2px rgba(95,207,128,0.25)' : undefined,
              borderColor: isSearching ? '#5fcf80' : '#2e2e2e',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
          {isSearching && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#aaa',
                fontSize: '14px',
                lineHeight: 1,
                padding: '0',
              }}
              title="クリア"
            >
              ✕
            </button>
          )}
        </div>
        {isSearching && (
          <span style={{ fontSize: '13px', color: '#606060' }}>
            {filteredStreams.length} 件の枠がヒット
          </span>
        )}
        {!isSearching && (
          <>
            <button className="btn-secondary" onClick={() => { setDefaultOpen(true); setMountKey((k) => k + 1) }}>▼ 全て開く</button>
            <button className="btn-secondary" onClick={() => { setDefaultOpen(false); setMountKey((k) => k + 1) }}>▲ 全て閉じる</button>
          </>
        )}
      </div>

      {filteredStreams.length === 0 && isSearching && (
        <p style={{ color: '#606060', fontSize: '14px' }}>「{trimmedQuery}」を含む枠が見つかりませんでした。</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filteredStreams.map((stream) => {
          const setlist = records
            .filter((r) => r.枠名 === stream.枠名)
            .filter((r) => !isSearching || r.楽曲名.toLowerCase().includes(trimmedQuery.toLowerCase()))
            .sort((a, b) => a.歌唱順 - b.歌唱順)
          const videoId = extractYtVideoId(stream.枠URL)
          const thumbUrl = videoId
            ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            : null
          const cleanUrl = videoId
            ? `https://www.youtube.com/live/${videoId}`
            : stream.枠URL
          const hasCollab = setlist.some(
            (r) => r.コラボ相手様 && r.コラボ相手様 !== 'なし'
          )

          return (
            <StreamExpander
              key={`${stream.枠名}_${stream.配信日}_${mountKey}`}
              label={`${stream.配信日}　${stream.枠名}`}
              forceOpen={isSearching}
              defaultOpen={defaultOpen}
              thumbUrl={thumbUrl}
              cleanUrl={cleanUrl}
              setlist={setlist}
              query={trimmedQuery}
              hasCollab={hasCollab}
            />
          )
        })}
      </div>
    </div>
  )
}

interface ExpanderProps {
  label: string
  forceOpen: boolean
  defaultOpen: boolean
  thumbUrl: string | null
  cleanUrl: string
  setlist: StreamingRecord[]
  query: string
  hasCollab: boolean
}

function StreamExpander({ label, forceOpen, defaultOpen, thumbUrl, cleanUrl, setlist, query, hasCollab }: ExpanderProps) {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const isOpen = forceOpen || localOpen

  return (
    <div className="expander">
      <button
        className="expander-header"
        onClick={() => setLocalOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span style={{ marginRight: '8px' }}>{isOpen ? '⚜' : '▶'}</span>
        <span dangerouslySetInnerHTML={{ __html: label }} />
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.38s ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
        <div className="expander-body">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px' }}>
            {/* サムネイル */}
            <div>
              {thumbUrl ? (
                <>
                  <img
                    src={thumbUrl}
                    alt="サムネイル"
                    style={{ width: '100%', borderRadius: '6px' }}
                  />
                  <a
                    href={cleanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#6a9e6a', display: 'block', marginTop: '4px' }}
                  >
                    ▶ YouTubeで開く
                  </a>
                </>
              ) : (
                <span style={{ fontSize: '13px', color: '#484848' }}>サムネイルなし</span>
              )}
            </div>

            {/* セットリスト */}
            <div style={{ overflowX: 'auto' }}>
              <table className="setlist-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>楽曲名</th>
                    {hasCollab && <th>コラボ相手様</th>}
                    <th>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {setlist.map((r, i) => {
                    const isHit = query.length > 0 && r.楽曲名.toLowerCase().includes(query.toLowerCase())
                    return (
                      <tr
                        key={i}
                        style={isHit ? { backgroundColor: 'rgba(95,207,128,0.12)' } : undefined}
                      >
                        <td style={{ textAlign: 'center', color: '#606060' }}>{r.歌唱順}</td>
                        <td style={isHit ? { fontWeight: 600, color: '#5fcf80' } : undefined}>
                          {r.楽曲名}
                        </td>
                        {hasCollab && (
                          <td style={{ color: '#888888' }}>
                            {r.コラボ相手様 && r.コラボ相手様 !== 'なし' ? r.コラボ相手様 : ''}
                          </td>
                        )}
                        <td>
                          {r.枠URL && (
                            <a href={r.枠URL} target="_blank" rel="noopener noreferrer" style={{ color: '#6a9e6a' }}>
                              ▶ 開く
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
