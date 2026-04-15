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

const VIDEOS = [
  { src: `${import.meta.env.BASE_URL}dia_moviecard_01.mp4`, grayscale: false, rate: 0.6  },
  { src: `${import.meta.env.BASE_URL}dia_moviecard_02.mp4`, grayscale: true,  rate: 1.0  },
  { src: `${import.meta.env.BASE_URL}dia_moviecard_03.mp4`, grayscale: true,  rate: 1.0  },
  { src: `${import.meta.env.BASE_URL}dia_moviecard_04.mp4`, grayscale: true,  rate: 0.6  },
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
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const videoARef        = useRef<HTMLVideoElement>(null)
  const videoBRef        = useRef<HTMLVideoElement>(null)
  const activeVideoRef   = useRef<'a' | 'b'>('a')
  const transitioningRef = useRef(false)
  const videoIndexRef    = useRef(0)
  const grainCanvasRef   = useRef<HTMLCanvasElement>(null)
  const grainAnimRef     = useRef<number>(0)
  const progressBarRef   = useRef<HTMLDivElement>(null)

  const FADE_BEFORE = 1.5
  const FADE_MS     = 1500

  useEffect(() => {
    const videoA = videoARef.current
    const videoB = videoBRef.current
    if (!videoA || !videoB) return

    videoA.style.filter  = 'none'
    videoA.playbackRate  = VIDEOS[0].rate
    videoA.style.opacity = '1'
    videoB.style.opacity = '0'

    const onTimeUpdate = (e: Event) => {
      if (transitioningRef.current) return
      const isA    = e.target === videoA
      if ((activeVideoRef.current === 'a') !== isA) return
      const current = isA ? videoA : videoB
      const next    = isA ? videoB : videoA
      if (!current.duration || isNaN(current.duration)) return
      if (current.duration - current.currentTime > FADE_BEFORE) return

      transitioningRef.current = true
      const nextIndex  = (videoIndexRef.current + 1) % VIDEOS.length
      const nextConfig = VIDEOS[nextIndex]

      next.src          = nextConfig.src
      next.style.filter = nextConfig.grayscale ? 'grayscale(1)' : 'none'
      next.load()
      next.currentTime  = 0
      next.playbackRate = nextConfig.rate
      next.play().catch(() => {})

      current.style.opacity = '0'
      next.style.opacity    = '1'

      setTimeout(() => {
        current.pause()
        current.currentTime    = 0
        videoIndexRef.current  = nextIndex
        setCurrentVideoIndex(nextIndex)
        activeVideoRef.current = isA ? 'b' : 'a'
        transitioningRef.current = false
      }, FADE_MS)
    }

    videoA.addEventListener('timeupdate', onTimeUpdate)
    videoB.addEventListener('timeupdate', onTimeUpdate)
    return () => {
      videoA.removeEventListener('timeupdate', onTimeUpdate)
      videoB.removeEventListener('timeupdate', onTimeUpdate)
    }
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

      const bar    = progressBarRef.current
      const videoA = videoARef.current
      const videoB = videoBRef.current
      if (bar && videoA && videoB) {
        const active   = activeVideoRef.current === 'a' ? videoA : videoB
        const progress = active.duration ? active.currentTime / active.duration : 0
        bar.style.width = `${progress * 100}%`
      }

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

  const skipToVideo = useCallback((index: number) => {
    if (transitioningRef.current || videoIndexRef.current === index) return
    const videoA = videoARef.current
    const videoB = videoBRef.current
    if (!videoA || !videoB) return

    transitioningRef.current = true
    const current = activeVideoRef.current === 'a' ? videoA : videoB
    const next    = activeVideoRef.current === 'a' ? videoB : videoA
    const config  = VIDEOS[index]

    next.src          = config.src
    next.style.filter = config.grayscale ? 'grayscale(1)' : 'none'
    next.load()
    next.currentTime  = 0
    next.playbackRate = config.rate
    next.play().catch(() => {})

    current.style.opacity = '0'
    next.style.opacity    = '1'

    setTimeout(() => {
      current.pause()
      current.currentTime      = 0
      videoIndexRef.current    = index
      setCurrentVideoIndex(index)
      activeVideoRef.current   = activeVideoRef.current === 'a' ? 'b' : 'a'
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
          <span className="sidebar-tagline">Every song---<br />an eternal trace.</span>
          <span className="sidebar-title">声の記録</span>
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
            <video ref={videoARef} className="hero-video" src={VIDEOS[0].src} autoPlay muted playsInline />
            <video ref={videoBRef} className="hero-video" muted playsInline />
            <canvas ref={grainCanvasRef} className="hero-grain" />
            <div className="hero-overlay" />
            <div className="hero-video-indicators">
              {VIDEOS.map((_, i) => (
                <div
                  key={i}
                  className={`hero-video-indicator${currentVideoIndex === i ? ' active' : ''}`}
                  onClick={() => skipToVideo(i)}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="hero-progress-track">
              <div ref={progressBarRef} className="hero-progress-bar" />
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
