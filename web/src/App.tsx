import { useState, useEffect } from 'react'
import { StreamingRecord } from './types'
import { parseCSV, parseSongMaster } from './utils/csv'
import StreamsTab from './components/StreamsTab'
import SongsTab from './components/SongsTab'
import AboutTab from './components/AboutTab'
import ChangelogTab from './components/ChangelogTab'
import Footer from './components/Footer'
import './App.css'

const STREAMING_CSV_URL =
  import.meta.env.VITE_CSV_URL ??
  'https://raw.githubusercontent.com/Kinshutei/Mikage_HishatainoHeya/main/streaminginfo_Mikage.csv'

const SONG_MASTER_URL =
  import.meta.env.VITE_MASTER_URL ??
  'https://raw.githubusercontent.com/Kinshutei/Mikage_HishatainoHeya/main/song_master_Mikage.csv'

const BANNER_URL =
  'https://yt3.googleusercontent.com/6REyrT4s7DrjAvRL0yJUJJxi3Ahb59XtcnnDNpu7lC7sojUKthxvBIWJDVSyExFi1BOyJPzZWg' +
  '=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj'

const MIKAGE_ICON = `${import.meta.env.BASE_URL}icon_mikage.png`

type Tab = 'streams' | 'songs' | 'about' | 'changelog'

export default function App() {
  const [records, setRecords] = useState<StreamingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('streams')

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // 楽曲マスターと配信情報を並行ロード
        const [masterRes, streamRes] = await Promise.all([
          fetch(SONG_MASTER_URL),
          fetch(STREAMING_CSV_URL),
        ])

        if (!masterRes.ok) throw new Error(`song_master HTTP ${masterRes.status}`)
        if (!streamRes.ok) throw new Error(`streaming_info HTTP ${streamRes.status}`)

        const [masterText, streamText] = await Promise.all([
          masterRes.text(),
          streamRes.text(),
        ])

        const masterMap = parseSongMaster(masterText)
        const parsed = parseCSV(streamText, masterMap)
        setRecords(parsed)
      } catch (e: unknown) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [])

  return (
    <div className="app">
      {/* バナー */}
      <div className="banner">
        <img src={BANNER_URL} alt="深影 バナー" />
      </div>

      {/* タブ */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'streams' ? 'active' : ''}`}
          onClick={() => setActiveTab('streams')}
        >
          <img src={MIKAGE_ICON} alt="" className="tab-icon" />
          LiveStreaming Info
        </button>
        <button
          className={`tab-btn ${activeTab === 'songs' ? 'active' : ''}`}
          onClick={() => setActiveTab('songs')}
        >
          <img src={MIKAGE_ICON} alt="" className="tab-icon" />
          Uta-Mita DB
        </button>
        <button
          className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <img src={MIKAGE_ICON} alt="" className="tab-icon" />
          About
        </button>
        <button
          className={`tab-btn ${activeTab === 'changelog' ? 'active' : ''}`}
          onClick={() => setActiveTab('changelog')}
        >
          <img src={MIKAGE_ICON} alt="" className="tab-icon" />
          更新履歴
        </button>
      </div>

      {/* コンテンツ */}
      <div className="content">
        {activeTab === 'about' ? (
          <AboutTab />
        ) : activeTab === 'changelog' ? (
          <ChangelogTab />
        ) : (
          <>
            {loading && <p style={{ color: '#888' }}>読み込み中...</p>}
            {error && <p style={{ color: '#c00' }}>データの取得に失敗しました: {error}</p>}
            {!loading && !error && (
              <>
                {activeTab === 'streams' && <StreamsTab records={records} />}
                {activeTab === 'songs' && <SongsTab records={records} />}
              </>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}
