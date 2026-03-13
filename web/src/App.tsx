import { useState, useEffect } from 'react'
import { StreamingRecord } from './types'
import { parseCSV } from './utils/csv'
import StreamsTab from './components/StreamsTab'
import SongsTab from './components/SongsTab'
import AboutTab from './components/AboutTab'
import ChangelogTab from './components/ChangelogTab'
import './App.css'

const CSV_URL =
  import.meta.env.VITE_CSV_URL ??
  'https://raw.githubusercontent.com/OWNER/REPO/main/streaming_info.csv'

const BANNER_URL =
  'https://yt3.googleusercontent.com/u3MLvApeviPLt_-RPfqiPB1ZPeEtaBknWDv-jKyzMGEijRaireQ2zfxK1HmkuDtJpUIW_uVXxEY' +
  '=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj'

const SNAKE_ICON = `${import.meta.env.BASE_URL}snake_kisaki.png`

type Tab = 'streams' | 'songs' | 'about' | 'changelog'

export default function App() {
  const [records, setRecords] = useState<StreamingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('streams')

  useEffect(() => {
    fetch(CSV_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((text) => {
        setRecords(parseCSV(text))
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  return (
    <div className="app">
      {/* バナー */}
      <div className="banner">
        <img src={BANNER_URL} alt="妃玖 バナー" />
      </div>

      {/* タブ */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'streams' ? 'active' : ''}`}
          onClick={() => setActiveTab('streams')}
        >
          <img src={SNAKE_ICON} alt="" className="tab-icon" />
          LiveStreaming Info
        </button>
        <button
          className={`tab-btn ${activeTab === 'songs' ? 'active' : ''}`}
          onClick={() => setActiveTab('songs')}
        >
          <img src={SNAKE_ICON} alt="" className="tab-icon" />
          Uta-Mita DB
        </button>
        <button
          className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <img src={SNAKE_ICON} alt="" className="tab-icon" />
          About
        </button>
        <button
          className={`tab-btn ${activeTab === 'changelog' ? 'active' : ''}`}
          onClick={() => setActiveTab('changelog')}
        >
          <img src={SNAKE_ICON} alt="" className="tab-icon" />
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
    </div>
  )
}
