import { useEffect, useRef } from 'react'

// ── 定数 ────────────────────────────────────────────
const R           = 38          // ノード間距離 (px)
const N_PARTICLES = 38          // パーティクル数
const SPEED_BASE  = 0.0095      // 基本速度 (t/frame)
const SPEED_VAR   = 0.0060      // 速度ばらつき
const TRAIL_LEN   = 16          // トレイル長
const LINE_ALPHA  = 0.10        // 籠目ライン不透明度
const RGB         = '95,207,128' // #5fcf80

// ── 型 ──────────────────────────────────────────────
interface GNode { x: number; y: number; nb: number[] }

interface Particle {
  from:   number
  to:     number
  t:      number
  spd:    number
  trail:  Float32Array
  head:   number
  filled: boolean
}

// ── 籠目グラフ構築 ──────────────────────────────────
function buildKagome(W: number, H: number): GNode[] {
  const sq3 = Math.sqrt(3)
  const b1x = 2 * R
  const b2x = R, b2y = R * sq3
  const M   = R * 3

  const map = new Map<string, number>()
  const ns: GNode[] = []

  const key = (x: number, y: number) =>
    `${Math.round(x)},${Math.round(y)}`

  function get(x: number, y: number): number {
    const k = key(x, y)
    if (map.has(k)) return map.get(k)!
    const id = ns.length
    ns.push({ x, y, nb: [] })
    map.set(k, id)
    return id
  }

  function link(x1: number, y1: number, x2: number, y2: number) {
    if (x1 < -M || x1 > W + M || y1 < -M || y1 > H + M) return
    if (x2 < -M || x2 > W + M || y2 < -M || y2 > H + M) return
    const a = get(x1, y1), b = get(x2, y2)
    if (!ns[a].nb.includes(b)) {
      ns[a].nb.push(b)
      ns[b].nb.push(a)
    }
  }

  const cols = Math.ceil(W / b1x) + 4
  const rows = Math.ceil(H / b2y) + 4

  for (let i = -3; i < cols; i++) {
    for (let j = -3; j < rows; j++) {
      const bx = i * b1x + j * b2x
      const by = j * b2y

      const px = bx,          py = by
      const qx = bx + R,      qy = by
      const rx = bx + R * .5, ry = by + R * sq3 * .5

      link(px, py, qx, qy)
      link(qx, qy, rx, ry)
      link(rx, ry, px, py)
      link(qx, qy, bx + b1x,              by)
      link(rx, ry, bx + b2x,              by + b2y)
      link(rx, ry, bx - b1x + b2x + R,   by + b2y)
    }
  }

  return ns
}

// ── パーティクル生成 ────────────────────────────────
function spawn(ns: GNode[]): Particle {
  const from = (Math.random() * ns.length) | 0
  const nb   = ns[from].nb
  const to   = nb[(Math.random() * nb.length) | 0]
  return {
    from, to,
    t:      Math.random(),
    spd:    SPEED_BASE + Math.random() * SPEED_VAR,
    trail:  new Float32Array(TRAIL_LEN * 2),
    head:   0,
    filled: false,
  }
}

// ── コンポーネント ──────────────────────────────────
export default function KagomeBg() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv  = ref.current!
    const ctx = cv.getContext('2d')!
    let rafId = 0
    let ns: GNode[]    = []
    let ps: Particle[] = []
    let bg: HTMLCanvasElement | null = null

    // ── 初期化 ──
    function init() {
      const W = window.innerWidth
      const H = window.innerHeight
      cv.width  = W
      cv.height = H

      ns = buildKagome(W, H)
      ps = Array.from({ length: N_PARTICLES }, () => spawn(ns))

      // 静的パターンをオフスクリーンCanvasに事前描画
      bg        = document.createElement('canvas')
      bg.width  = W
      bg.height = H
      const bgCtx = bg.getContext('2d')!
      bgCtx.strokeStyle = `rgba(${RGB},${LINE_ALPHA})`
      bgCtx.lineWidth   = 0.6
      bgCtx.beginPath()
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i]
        for (const j of n.nb) {
          if (j > i) {
            bgCtx.moveTo(n.x, n.y)
            bgCtx.lineTo(ns[j].x, ns[j].y)
          }
        }
      }
      bgCtx.stroke()
    }

    // ── 毎フレーム ──
    function frame() {
      ctx.clearRect(0, 0, cv.width, cv.height)
      if (bg) ctx.drawImage(bg, 0, 0)

      for (const p of ps) {
        p.t += p.spd
        const nA = ns[p.from], nB = ns[p.to]
        const tc = Math.min(p.t, 1)
        const x  = nA.x + (nB.x - nA.x) * tc
        const y  = nA.y + (nB.y - nA.y) * tc

        // 循環バッファにトレイル記録
        p.trail[p.head * 2]     = x
        p.trail[p.head * 2 + 1] = y
        p.head = (p.head + 1) % TRAIL_LEN
        if (p.head === 0) p.filled = true

        // ノード到達 → 次辺を選択
        if (p.t >= 1) {
          p.t -= 1
          const prev    = p.from
          p.from        = p.to
          const choices = ns[p.to].nb.filter(n => n !== prev)
          p.to = choices.length > 0
            ? choices[(Math.random() * choices.length) | 0]
            : prev
        }

        // トレイル描画（古→新の順）
        const len = p.filled ? TRAIL_LEN : p.head
        for (let s = 0; s < len; s++) {
          const idx = (p.head - len + s + TRAIL_LEN * 2) % TRAIL_LEN
          const tx  = p.trail[idx * 2]
          const ty  = p.trail[idx * 2 + 1]
          const frac = (s + 1) / len
          ctx.beginPath()
          ctx.arc(tx, ty, 0.2 + frac * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${RGB},${frac * 0.30})`
          ctx.fill()
        }

        // 先頭の輝点
        ctx.beginPath()
        ctx.arc(x, y, 0.9, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${RGB},0.50)`
        ctx.fill()
      }

      rafId = requestAnimationFrame(frame)
    }

    init()
    frame()

    // リサイズ対応（200ms デバウンス）
    let timer = 0
    const onResize = () => {
      clearTimeout(timer)
      timer = window.setTimeout(init, 200) as unknown as number
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
