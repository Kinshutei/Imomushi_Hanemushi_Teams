export interface StreamingRecord {
  枠名: string
  楽曲名: string
  歌唱順: number
  配信日: string
  枠URL: string
  コラボ相手様: string
  原曲Artist: string
  作詞: string
  作曲: string
  リリース日: string
}

export interface StreamInfo {
  枠名: string
  配信日: string
  枠URL: string
}

export interface SongStat {
  楽曲名: string
  原曲アーティスト: string
  作詞: string
  作曲: string
  リリース日: string
  リリース年: string
  歌唱回数: number
}
