import Papa from 'papaparse'
import { StreamingRecord, SongStat } from '../types'

export function parseCSV(text: string): StreamingRecord[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  return result.data.map((row) => ({
    枠名: row['枠名'] ?? '',
    楽曲名: row['楽曲名'] ?? '',
    歌唱順: parseInt(row['歌唱順'] ?? '0', 10) || 0,
    配信日: normalizeDate(row['配信日'] ?? ''),
    枠URL: row['枠URL'] ?? '',
    コラボ相手様: row['コラボ相手様'] ?? 'なし',
    原曲Artist: row['原曲Artist'] ?? '',
    作詞: row['作詞'] ?? '',
    作曲: row['作曲'] ?? '',
    リリース日: row['リリース日'] ?? '',
  }))
}

function normalizeDate(val: string): string {
  const m = val.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return val
}

export function toReleaseYear(val: string): string {
  if (!val || val === 'nan' || val === 'NaN') return ''
  const m = val.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  const normalized = m
    ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    : val
  const d = new Date(normalized)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年`
}

export function aggregateSongs(records: StreamingRecord[]): SongStat[] {
  const map = new Map<string, SongStat>()
  for (const r of records) {
    if (!r.楽曲名) continue
    const existing = map.get(r.楽曲名)
    if (existing) {
      existing.歌唱回数++
      if (!existing.原曲アーティスト && r.原曲Artist) existing.原曲アーティスト = r.原曲Artist
      if (!existing.作詞 && r.作詞) existing.作詞 = r.作詞
      if (!existing.作曲 && r.作曲) existing.作曲 = r.作曲
      if (!existing.リリース日 && r.リリース日) {
        existing.リリース日 = r.リリース日
        existing.リリース年 = toReleaseYear(r.リリース日)
      }
    } else {
      map.set(r.楽曲名, {
        楽曲名: r.楽曲名,
        原曲アーティスト: r.原曲Artist,
        作詞: r.作詞,
        作曲: r.作曲,
        リリース日: r.リリース日,
        リリース年: toReleaseYear(r.リリース日),
        歌唱回数: 1,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.歌唱回数 - a.歌唱回数)
}

export function extractYtVideoId(url: string): string | null {
  const m = url.match(/(?:v=|live\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}
