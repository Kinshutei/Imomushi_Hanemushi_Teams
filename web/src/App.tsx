import { useState, useEffect } from 'react'
import { StreamingRecord } from './types'
import { parseSongMaster, parseStreamingCSV } from './utils/csv'
import StreamsTab from './components/StreamsTab'
import SongsTab from './components/SongsTab'
import AboutTab from './components/AboutTab'
import ChangelogTab from './components/ChangelogTab'
import KagomeBg from './components/KagomeBg'
import Footer from './components/Footer'
import './App.css'

const CSV_URL =
  import.meta.env.VITE_CSV_URL ??
  'https://raw.githubusercontent.com/OWNER/REPO/main/streaming_info.csv'

const MASTER_URL =
  import.meta.env.VITE_MASTER_CSV_URL ??
  'https://raw.githubusercontent.com/OWNER/REPO/main/rkmusic_song_master.csv'

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
  const [mobileContentOpen, setMobileContentOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(MASTER_URL).then((r) => {
        if (!r.ok) throw new Error(`master HTTP ${r.status}`)
        return r.text()
      }),
      fetch(CSV_URL).then((r) => {
        if (!r.ok) throw new Error(`streaming HTTP ${r.status}`)
        return r.text()
      }),
    ])
      .then(([masterText, csvText]) => {
        const masterMap = parseSongMaster(masterText)
        setRecords(parseStreamingCSV(csvText, masterMap))
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  return (
    <>
      <KagomeBg />

      <div className="app">
        {/* バナー */}
        <div className="banner">
          <img src={BANNER_URL} alt="妃玖 バナー" />
        </div>

        {/* タブ（PC） */}
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

        {/* モバイルナビ（スマホのみ表示） */}
        <div className="mobile-nav">
          <div className="mobile-nav-content-wrap">
            <button
              className={`mobile-nav-main-btn${activeTab !== 'about' ? ' mobile-active' : ''}`}
              onClick={() => setMobileContentOpen((v) => !v)}
            >
              Content
              <span className={`mobile-nav-caret${mobileContentOpen ? ' open' : ''}`}>▾</span>
            </button>
            <div className={`mobile-nav-dropdown${mobileContentOpen ? ' open' : ''}`}>
              <button
                className={activeTab === 'streams' ? 'mobile-active' : ''}
                onClick={() => { setActiveTab('streams'); setMobileContentOpen(false) }}
              >LiveStreaming Info</button>
              <button
                className={activeTab === 'songs' ? 'mobile-active' : ''}
                onClick={() => { setActiveTab('songs'); setMobileContentOpen(false) }}
              >Uta-Mita DB</button>
              <button
                className={activeTab === 'changelog' ? 'mobile-active' : ''}
                onClick={() => { setActiveTab('changelog'); setMobileContentOpen(false) }}
              >更新履歴</button>
            </div>
          </div>
          <button
            className={`mobile-nav-main-btn${activeTab === 'about' ? ' mobile-active' : ''}`}
            onClick={() => { setActiveTab('about'); setMobileContentOpen(false) }}
          >About</button>
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
      <Footer />
    </>
  )
}
