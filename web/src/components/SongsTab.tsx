import { useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import { StreamingRecord, SongStat } from '../types'
import { aggregateSongs } from '../utils/csv'

interface Props {
  records: StreamingRecord[]
}

type SortKey = keyof SongStat
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: '楽曲名',           label: '楽曲名' },
  { key: '原曲アーティスト', label: '原曲アーティスト' },
  { key: '作詞',             label: '作詞' },
  { key: '作曲',             label: '作曲' },
  { key: 'リリース日',       label: 'リリース日' },
  { key: 'リリース年',       label: 'リリース年' },
  { key: '歌唱回数',         label: '歌唱回数' },
]

function sortSongs(songs: SongStat[], key: SortKey, dir: SortDir): SongStat[] {
  return [...songs].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    let cmp: number
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'ja')
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

export default function SongsTab({ records }: Props) {
  const songs: SongStat[] = useMemo(() => aggregateSongs(records), [records])

  // ── ソート状態（初期: 歌唱回数降順）──
  const [sortKey, setSortKey] = useState<SortKey>('歌唱回数')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedSongs = useMemo(
    () => sortSongs(songs, sortKey, sortDir),
    [songs, sortKey, sortDir]
  )

  // グラフは元の集計順（歌唱回数降順）を維持
  const top20 = songs.slice(0, 20)

  // ── グラフリセット用キー ──
  const [barKey, setBarKey] = useState(0)
  const [treeKey, setTreeKey] = useState(0)
  const [treeKey2, setTreeKey2] = useState(0)

  // ── 横棒グラフ用データ ──
  const maxCount = top20[0]?.歌唱回数 ?? 1
  const barColors = top20.map(
    (s) => `rgba(95,207,128,${0.2 + 0.7 * (s.歌唱回数 / maxCount)})`
  )

  // ── リリース年ツリーマップ用データ ──
  const yearMap = new Map<string, number>()
  for (const s of songs) {
    if (!s.リリース年) continue
    yearMap.set(s.リリース年, (yearMap.get(s.リリース年) ?? 0) + 1)
  }
  const years = Array.from(yearMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const yearTotal = years.reduce((sum, [, v]) => sum + v, 0)

  // ── 原曲アーティストツリーマップ用データ ──
  const artistMap = new Map<string, number>()
  for (const s of songs) {
    const artist = s.原曲アーティスト?.trim()
    if (!artist) continue
    artistMap.set(artist, (artistMap.get(artist) ?? 0) + s.歌唱回数)
  }
  const artists = Array.from(artistMap.entries()).sort((a, b) => b[1] - a[1])
  const artistTotal = artists.reduce((sum, [, v]) => sum + v, 0)

  if (records.length === 0) {
    return <p style={{ color: '#888', padding: '1rem' }}>曲がまだ登録されていません。</p>
  }

  const handleHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === '歌唱回数' ? 'desc' : 'asc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ color: '#ccc', marginLeft: 4 }}>⇅</span>
    return <span style={{ color: '#6a9e6a', marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div>
      {/* 曲一覧テーブル */}
      <div style={{ overflowX: 'auto', marginBottom: '32px' }}>
        <table className="songs-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '28%' }} />   {/* 楽曲名 */}
            <col style={{ width: '14%' }} />   {/* 原曲アーティスト */}
            <col style={{ width: '10%' }} />   {/* 作詞 */}
            <col style={{ width: '10%' }} />   {/* 作曲 */}
            <col style={{ width: '12%' }} />   {/* リリース日 */}
            <col style={{ width: '8%' }} />    {/* リリース年 */}
            <col style={{ width: '72px' }} />  {/* 歌唱回数 */}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleHeaderClick(key)}
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    background: sortKey === key ? '#1e2e1e' : undefined,
                  }}
                >
                  {label}{sortIndicator(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSongs.map((s, i) => (
              <tr key={i}>
                <td>{s.楽曲名}</td>
                <td style={{ color: '#666' }}>{s.原曲アーティスト}</td>
                <td style={{ color: '#666' }}>{s.作詞}</td>
                <td style={{ color: '#666' }}>{s.作曲}</td>
                <td style={{ color: '#666' }}>{s.リリース日}</td>
                <td style={{ color: '#666' }}>{s.リリース年}</td>
                <td style={{ textAlign: 'center', fontWeight: 600, color: '#6a9e6a' }}>{s.歌唱回数}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 横棒グラフ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <h3 style={{ color: '#555', margin: 0 }}>歌唱回数ランキング（上位20曲）</h3>
        <button className="btn-secondary" onClick={() => setBarKey((k) => k + 1)} title="ズームをリセット">
          🏠 リセット
        </button>
      </div>
      <Plot
        key={barKey}
        data={[{
          type: 'bar',
          orientation: 'h',
          x: top20.map((s) => s.歌唱回数),
          y: top20.map((s) => s.楽曲名),
          text: top20.map((s) => String(s.歌唱回数)),
          textposition: 'outside',
          marker: { color: barColors, line: { width: 0 } },
          customdata: top20.map((s) => [s.原曲アーティスト, s.作詞, s.作曲]),
          hovertemplate: '<b>%{y}</b><br>歌唱回数: %{x}<br>Artist: %{customdata[0]}<extra></extra>',
        }]}
        layout={{
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { family: 'Noto Sans JP', color: '#a0a0a0', size: 12 },
          yaxis: { autorange: 'reversed', showgrid: false, tickfont: { size: 11 }, color: '#a0a0a0' },
          xaxis: { showgrid: true, gridcolor: 'rgba(255,255,255,0.05)', zeroline: false, color: '#606060' },
          margin: { l: 10, r: 55, t: 16, b: 10 },
          height: Math.max(380, top20.length * 26),
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
        useResizeHandler
      />

      {/* ツリーマップ */}
      {years.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '24px 0 8px' }}>
            <h3 style={{ color: '#555', margin: 0 }}>リリース年度分布</h3>
            <button className="btn-secondary" onClick={() => setTreeKey((k) => k + 1)} title="ズームをリセット">
              🏠 リセット
            </button>
          </div>
          <Plot
            key={treeKey}
            data={[{
              type: 'treemap',
              labels: years.map(([y]) => y),
              parents: years.map(() => ''),
              values: years.map(([, v]) => v),
              text: years.map(([, v]) => `${(v / yearTotal * 100).toFixed(1)}%`),
              texttemplate: '<b>%{label}</b><br>%{value}曲<br>%{text}',
              hovertemplate: '<b>%{label}</b><br>%{value}曲 (%{text})<extra></extra>',
              marker: {
                colors: years.map(([, v]) => v),
                colorscale: [[0.0,'#1a2e1a'],[0.4,'#2a4a2a'],[0.7,'#3a7a4a'],[1.0,'#5fcf80']],
                line: { width: 2, color: '#ffffff' },
                pad: { t: 22, l: 4, r: 4, b: 4 },
              },
            }]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Noto Sans JP', color: '#c0c0c0' },
              margin: { t: 4, l: 0, r: 0, b: 0 },
              height: 380,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
            useResizeHandler
          />
        </>
      )}

      {/* 原曲アーティスト分布ツリーマップ */}
      {artists.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '24px 0 8px' }}>
            <h3 style={{ color: '#555', margin: 0 }}>原曲アーティスト分布</h3>
            <button className="btn-secondary" onClick={() => setTreeKey2((k) => k + 1)} title="ズームをリセット">
              🏠 リセット
            </button>
          </div>
          <Plot
            key={treeKey2}
            data={[{
              type: 'treemap',
              labels: artists.map(([a]) => a),
              parents: artists.map(() => ''),
              values: artists.map(([, v]) => v),
              text: artists.map(([, v]) => `${(v / artistTotal * 100).toFixed(1)}%`),
              texttemplate: '<b>%{label}</b><br>%{value}曲<br>%{text}',
              hovertemplate: '<b>%{label}</b><br>%{value}曲 (%{text})<extra></extra>',
              marker: {
                colors: artists.map(([, v]) => v),
                colorscale: [
                  [0.0, '#1a2e1a'],
                  [0.4, '#2a4a2a'],
                  [0.7, '#3a7a4a'],
                  [1.0, '#5fcf80'],
                ],
                line: { width: 2, color: '#ffffff' },
                pad: { t: 22, l: 4, r: 4, b: 4 },
              },
            }]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Noto Sans JP', color: '#c0c0c0' },
              margin: { t: 4, l: 0, r: 0, b: 0 },
              height: 420,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
            useResizeHandler
          />
        </>
      )}
    </div>
  )
}
