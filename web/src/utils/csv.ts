import Papa from 'papaparse'
import { StreamingRecord, SongMaster, SongStat } from '../types'

// ─────────────────────────────────────────
// 楽曲マスター
// ─────────────────────────────────────────
export function parseSongMaster(text: string): Map<string, SongMaster> {
  const cleaned = text.replace(/^﻿/, '')
  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
  })
  const map = new Map<string, SongMaster>()
  for (const row of result.data) {
    const id = (row['song_id'] ?? row['﻿song_id'])?.trim()
    if (!id) continue
    map.set(id, {
      song_id: id,
      楽曲名: row['楽曲名'] ?? '',
      原曲アーティスト: row['原曲アーティスト'] ?? '',
      作詞: row['作詞'] ?? '',
      作曲: row['作曲'] ?? '',
      リリース日: row['リリース日'] ?? '',
    })
  }
  return map
}

// ─────────────────────────────────────────
// 配信情報 CSV（新形式: song_id参照 / 旧形式: 楽曲名直書き 両対応）
// ─────────────────────────────────────────
export function parseCSV(
  text: string,
  masterMap: Map<string, SongMaster> = new Map()
): StreamingRecord[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  return result.data.map((row) => {
    const songId = row['song_id']?.trim() ?? ''
    const master = masterMap.get(songId)

    // 新形式（song_id あり）→ マスターから楽曲情報を補完
    // 旧形式（song_id なし）→ 行内の値をそのまま使用（後方互換）
    return {
      枠名:         row['枠名'] ?? '',
      song_id:      songId,
      楽曲名:       master?.楽曲名 ?? row['楽曲名'] ?? '',
      歌唱順:       parseInt(row['歌唱順'] ?? '0', 10) || 0,
      配信日:       normalizeDate(row['配信日'] ?? ''),
      枠URL:        row['枠URL'] ?? '',
      コラボ相手様: row['コラボ相手様'] ?? 'なし',
      原曲Artist:   master?.原曲アーティスト ?? row['原曲Artist'] ?? '',
      作詞:         master?.作詞 ?? row['作詞'] ?? '',
      作曲:         master?.作曲 ?? row['作曲'] ?? '',
      リリース日:   master?.リリース日 ?? row['リリース日'] ?? '',
    }
  })
}

// ─────────────────────────────────────────
// 日付正規化
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// 楽曲集計
// ─────────────────────────────────────────
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
        楽曲名:         r.楽曲名,
        原曲アーティスト: r.原曲Artist,
        作詞:           r.作詞,
        作曲:           r.作曲,
        リリース日:     r.リリース日,
        リリース年:     toReleaseYear(r.リリース日),
        歌唱回数:       1,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.歌唱回数 - a.歌唱回数)
}

export function extractYtVideoId(url: string): string | null {
  const m = url.match(/(?:v=|live\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}
