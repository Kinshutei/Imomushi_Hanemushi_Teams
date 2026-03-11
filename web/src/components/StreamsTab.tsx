import { useState } from 'react'
import { StreamingRecord } from '../types'
import { extractYtVideoId } from '../utils/csv'

interface Props {
  records: StreamingRecord[]
}

export default function StreamsTab({ records }: Props) {
  const [expandedAll, setExpandedAll] = useState(false)

  if (records.length === 0) {
    return <p style={{ color: '#888', padding: '1rem' }}>配信枠がまだ登録されていません。</p>
  }

  // 枠単位に集約（日付降順）
  const streams = Array.from(
    new Map(
      records
        .sort((a, b) => b.配信日.localeCompare(a.配信日))
        .map((r) => [`${r.枠名}__${r.配信日}`, { 枠名: r.枠名, 配信日: r.配信日, 枠URL: r.枠URL }])
    ).values()
  )

  return (
    <div>
      {/* 展開/折りたたみボタン */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button className="btn-secondary" onClick={() => setExpandedAll(true)}>▼ 全て開く</button>
        <button className="btn-secondary" onClick={() => setExpandedAll(false)}>▲ 全て閉じる</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {streams.map((stream) => {
          const setlist = records
            .filter((r) => r.枠名 === stream.枠名)
            .sort((a, b) => a.歌唱順 - b.歌唱順)
          const videoId = extractYtVideoId(stream.枠URL)
          const thumbUrl = videoId
            ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            : null
          const cleanUrl = videoId
            ? `https://www.youtube.com/live/${videoId}`
            : stream.枠URL

          return (
            <StreamExpander
              key={`${stream.枠名}_${stream.配信日}`}
              label={`${stream.配信日}　${stream.枠名}`}
              forceOpen={expandedAll}
              thumbUrl={thumbUrl}
              cleanUrl={cleanUrl}
              setlist={setlist}
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
  thumbUrl: string | null
  cleanUrl: string
  setlist: StreamingRecord[]
}

function StreamExpander({ label, forceOpen, thumbUrl, cleanUrl, setlist }: ExpanderProps) {
  const [localOpen, setLocalOpen] = useState(false)
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

      {isOpen && (
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
                <span style={{ fontSize: '12px', color: '#aaa' }}>サムネイルなし</span>
              )}
            </div>

            {/* セットリスト */}
            <div style={{ overflowX: 'auto' }}>
              <table className="setlist-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>楽曲名</th>
                    <th>コラボ相手様</th>
                    <th>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {setlist.map((r, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'center', color: '#888' }}>{r.歌唱順}</td>
                      <td>{r.楽曲名}</td>
                      <td style={{ color: '#888' }}>{r.コラボ相手様 === 'なし' ? '' : r.コラボ相手様}</td>
                      <td>
                        {r.枠URL && (
                          <a href={r.枠URL} target="_blank" rel="noopener noreferrer" style={{ color: '#6a9e6a' }}>
                            ▶ 開く
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
