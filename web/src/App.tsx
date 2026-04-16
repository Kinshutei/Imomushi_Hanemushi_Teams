import { useState, useEffect, useRef, useCallback } from 'react'
import { StreamingRecord } from './types'
import { parseSongMaster, parseStreamingCSV } from './utils/csv'
import StreamsTab from './components/StreamsTab'
import SongsTab from './components/SongsTab'
import AboutTab from './components/AboutTab'
import ChangelogTab from './components/ChangelogTab'
import TerminalMessage from './components/TerminalMessage'
import './App.css'

const CSV_URL =
  import.meta.env.VITE_CSV_URL ??
  'https://raw.githubusercontent.com/Kinshutei/Imomushi_Hanemushi_Teams/main/streaming_info.json'

const MASTER_URL =
  import.meta.env.VITE_MASTER_CSV_URL ??
  'https://raw.githubusercontent.com/Kinshutei/Imomushi_Hanemushi_Teams/main/rkmusic_song_master.json'

const IMAGES = [
  `${import.meta.env.BASE_URL}kisaki_imagecard_01.jpg`,
  `${import.meta.env.BASE_URL}kisaki_imagecard_02.jpg`,
  `${import.meta.env.BASE_URL}kisaki_imagecard_03.jpg`,
]

type Tab = 'streams' | 'songs' | 'about' | 'changelog'

const NAV_ITEMS: { tab: Tab; label: string }[] = [
  { tab: 'streams',   label: 'LiveStreaming INFO' },
  { tab: 'songs',     label: 'Sung Repertoire'   },
  { tab: 'about',     label: 'About'              },
  { tab: 'changelog', label: '更新履歴'           },
]

export default function App() {
  const [records,      setRecords]      = useState<StreamingRecord[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [activeTab,    setActiveTab]    = useState<Tab | null>(null)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [terminalKey,      setTerminalKey]      = useState(0)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const imgARef          = useRef<HTMLImageElement>(null)
  const imgBRef          = useRef<HTMLImageElement>(null)
  const activeImgRef     = useRef<'a' | 'b'>('a')
  const transitioningRef = useRef(false)
  const imgIndexRef      = useRef(0)
  const grainCanvasRef   = useRef<HTMLCanvasElement>(null)
  const grainAnimRef     = useRef<number>(0)

  const FADE_MS = 1500

  useEffect(() => {
    const imgA = imgARef.current
    const imgB = imgBRef.current
    if (!imgA || !imgB) return

    imgA.style.opacity = '1'
    imgB.style.opacity = '0'

    const advance = () => {
      if (transitioningRef.current) return
      transitioningRef.current = true
      const isA      = activeImgRef.current === 'a'
      const current  = isA ? imgA : imgB
      const next     = isA ? imgB : imgA
      const nextIndex = (imgIndexRef.current + 1) % IMAGES.length

      next.src           = IMAGES[nextIndex]
      current.style.opacity = '0'
      next.style.opacity    = '1'

      setTimeout(() => {
        imgIndexRef.current    = nextIndex
        setCurrentImageIndex(nextIndex)
        activeImgRef.current   = isA ? 'b' : 'a'
        transitioningRef.current = false
      }, FADE_MS)
    }

    const timer = setInterval(advance, 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(MASTER_URL).then((r) => {
        if (!r.ok) throw new Error(`master HTTP ${r.status}`)
        return r.json()
      }),
      fetch(CSV_URL).then((r) => {
        if (!r.ok) throw new Error(`streaming HTTP ${r.status}`)
        return r.json()
      }),
    ])
      .then(([masterData, csvData]) => {
        const masterMap = parseSongMaster(masterData)
        setRecords(parseStreamingCSV(csvData, masterMap))
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const canvas = grainCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const SCALE = 2

    let imageData: ImageData | null = null
    let data: Uint8ClampedArray | null = null

    const resize = () => {
      canvas.width  = Math.ceil(canvas.offsetWidth  / SCALE)
      canvas.height = Math.ceil(canvas.offsetHeight / SCALE)
      imageData = ctx.createImageData(canvas.width, canvas.height)
      data      = imageData.data
    }
    resize()
    window.addEventListener('resize', resize)

    let frame = 0
    const loop = () => {
      frame++

      if (frame % 4 === 0 && imageData && data) {
        data.fill(0)
        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() > 0.22) continue
          const v = Math.floor(Math.random() * 40)
          const a = Math.floor(Math.random() * 80 + 20)
          data[i]     = v
          data[i + 1] = v
          data[i + 2] = v
          data[i + 3] = a
        }
        ctx.putImageData(imageData, 0, 0)
      }

      grainAnimRef.current = requestAnimationFrame(loop)
    }

    grainAnimRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(grainAnimRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const skipToImage = useCallback((index: number) => {
    if (transitioningRef.current || imgIndexRef.current === index) return
    const imgA = imgARef.current
    const imgB = imgBRef.current
    if (!imgA || !imgB) return

    transitioningRef.current = true
    const current = activeImgRef.current === 'a' ? imgA : imgB
    const next    = activeImgRef.current === 'a' ? imgB : imgA

    next.src              = IMAGES[index]
    current.style.opacity = '0'
    next.style.opacity    = '1'

    setTimeout(() => {
      imgIndexRef.current      = index
      setCurrentImageIndex(index)
      activeImgRef.current     = activeImgRef.current === 'a' ? 'b' : 'a'
      transitioningRef.current = false
    }, FADE_MS)
  }, [])

  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  const handleLogoClick = () => {
    setActiveTab(null)
    setTerminalKey(k => k + 1)
    setSidebarOpen(false)
  }

  return (
    <div className="layout">

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-top" onClick={handleLogoClick}>
          <span className="sidebar-tagline">CasaCasa....MozoMozo...</span>
          <span className="sidebar-title">芋虫羽虫㌠の部屋</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ tab, label }) => (
            <button
              key={tab}
              className={`sidebar-nav-item${activeTab === tab ? ' active' : ''}`}
              onClick={() => handleNavClick(tab)}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main-area">

        <button
          className={`hamburger${sidebarOpen ? ' hamburger--open' : ''}`}
          onClick={() => setSidebarOpen(s => !s)}
          aria-label="メニュー"
        >
          <span /><span /><span />
        </button>

        {(activeTab === null || activeTab === 'about' || activeTab === 'streams') && (
          <section className="hero-section">
            <img ref={imgARef} className="hero-video" src={IMAGES[0]} alt="" />
            <img ref={imgBRef} className="hero-video" alt="" />
            <canvas ref={grainCanvasRef} className="hero-grain" />
            <div className="hero-overlay" />
            <div className="hero-video-indicators">
              {IMAGES.map((_, i) => (
                <div
                  key={i}
                  className={`hero-video-indicator${currentImageIndex === i ? ' active' : ''}`}
                  onClick={() => skipToImage(i)}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="hero-terminal">
              <TerminalMessage key={terminalKey} />
            </div>
            {activeTab === 'about' && (
              <div className="hero-about">
                <button className="hero-about-close" onClick={handleLogoClick}>× CLOSE</button>
                <div className="hero-about-body">
                  <AboutTab />
                </div>
              </div>
            )}
            {activeTab === 'streams' && (
              <div className="hero-streams">
                <button className="hero-about-close" onClick={handleLogoClick}>× CLOSE</button>
                <div className="hero-streams-body">
                  {loading && <p className="status-text">読み込み中...</p>}
                  {error   && <p className="status-text status-text--error">データの取得に失敗しました: {error}</p>}
                  {!loading && !error && <StreamsTab records={records} />}
                </div>
              </div>
            )}
          </section>
        )}

        {(activeTab === 'songs' || activeTab === 'changelog') && (
          <main className="content-area">
            <button className="back-btn" onClick={handleLogoClick}>
              ← BACK TO HOME
            </button>
            {loading && <p className="status-text">読み込み中...</p>}
            {error   && <p className="status-text status-text--error">データの取得に失敗しました: {error}</p>}
            {activeTab === 'songs'     && !loading && !error && <SongsTab   records={records} />}
            {activeTab === 'changelog' && <ChangelogTab />}
          </main>
        )}
      </div>

    </div>
  )
}
