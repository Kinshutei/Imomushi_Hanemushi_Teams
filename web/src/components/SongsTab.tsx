import { useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import { StreamingRecord, SongStat } from '../types'
import { aggregateSongs, toReleaseYear } from '../utils/csv'

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

  const [sortKey, setSortKey] = useState<SortKey>('歌唱回数')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedSongs = useMemo(
    () => sortSongs(songs, sortKey, sortDir),
    [songs, sortKey, sortDir]
  )

  // グラフは歌唱回数降順を維持
  const top20 = songs.slice(0, 20)

  const [barKey, setBarKey] = useState(0)
  const [yearBarKey, setYearBarKey] = useState(0)
  const [treeKey2, setTreeKey2] = useState(0)

  // 横棒グラフ用
  const maxCount = top20[0]?.歌唱回数 ?? 1
  const barColors = top20.map(
    (s) => `rgba(95,207,128,${0.2 + 0.7 * (s.歌唱回数 / maxCount)})`
  )

  // リリース年棒グラフ用
  const yearMap = new Map<string, number>()
  for (const s of songs) {
    const y = toReleaseYear(s.リリース日)
    if (!y) continue
    yearMap.set(y, (yearMap.get(y) ?? 0) + 1)
  }
  const years = Array.from(yearMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const yearMaxVal = Math.max(...years.map(([, v]) => v), 1)

  // 原曲アーティストツリーマップ用
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

  // 1行あたり約36px、25行分でスクロール
  const TABLE_MAX_HEIGHT = 25 * 36

  return (
    <div>
      {/* 曲一覧テーブル */}
      <p style={{ color: '#606060', fontSize: '14px', margin: '0 0 8px' }}>全 {sortedSongs.length} 曲</p>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: `${TABLE_MAX_HEIGHT}px`, marginBottom: '32px' }}>
        <table className="songs-table">
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
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
                <td style={{ textAlign: 'center', fontWeight: 600, color: '#6a9e6a' }}>{s.歌唱回数}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 歌唱回数ランキング横棒グラフ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <h3 style={{ color: '#555', margin: 0 }}>歌唱回数ランキング（上位20曲）</h3>
        <button className="btn-secondary" onClick={() => setBarKey((k) => k + 1)} title="ズームをリセット">
          リセット
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
          yaxis: {
            autorange: 'reversed',
            showgrid: false,
            tickfont: { size: 11 },
            color: '#a0a0a0',
            automargin: true,
          },
          xaxis: { showgrid: true, gridcolor: 'rgba(255,255,255,0.05)', zeroline: false, color: '#606060' },
          margin: { l: 16, r: 55, t: 16, b: 10 },
          height: Math.max(380, top20.length * 26),
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
        useResizeHandler
      />

      {/* リリース年度分布（棒グラフ） */}
      {years.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '24px 0 8px' }}>
            <h3 style={{ color: '#555', margin: 0 }}>リリース年度分布</h3>
            <button className="btn-secondary" onClick={() => setYearBarKey((k) => k + 1)} title="ズームをリセット">
              リセット
            </button>
          </div>
          <Plot
            key={yearBarKey}
            data={[{
              type: 'bar',
              x: years.map(([y]) => y),
              y: years.map(([, v]) => v),
              text: years.map(([, v]) => String(v)),
              textposition: 'outside',
              marker: {
                color: years.map(([, v]) => `rgba(95,207,128,${0.25 + 0.65 * (v / yearMaxVal)})`),
                line: { width: 0 },
              },
              hovertemplate: '<b>%{x}</b><br>%{y}曲<extra></extra>',
            }]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Noto Sans JP', color: '#a0a0a0', size: 11 },
              xaxis: {
                tickfont: { size: 10 },
                color: '#606060',
                tickangle: -45,
                showgrid: false,
              },
              yaxis: {
                showgrid: true,
                gridcolor: 'rgba(255,255,255,0.05)',
                zeroline: false,
                color: '#606060',
              },
              margin: { l: 40, r: 20, t: 24, b: 70 },
              height: 320,
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
              リセット
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
