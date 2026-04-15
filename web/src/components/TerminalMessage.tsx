import { useState, useEffect, useRef } from 'react'

type LineType = 'system' | 'header' | 'warning' | 'message' | 'separator' | 'status' | 'blank'

interface LineConfig {
  text: string
  speed: number
  preDelay: number
  type: LineType
}

const S = (text: string, speed: number, preDelay: number, type: LineType = 'system'): LineConfig =>
  ({ text, speed, preDelay, type })
const B = (preDelay = 200): LineConfig =>
  ({ text: '', speed: 0, preDelay, type: 'blank' })
const SEP = (preDelay = 100): LineConfig =>
  ({ text: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', speed: 12, preDelay, type: 'separator' })

const LINES: LineConfig[] = [
  S('KISAKI VOCAL ARCHIVE SYSTEM',                            35,  800),
  S('REV. 1.0 \u2014 INITIALIZED',                           35,   80),
  B(300),
  S('BOOTING...',                                             55,  200),
  S('BOOTING...',                                             55,  400),
  S('BOOTING...',                                             55,  400),
  B(200),
  S('STORAGE CHECK ............... 64K / OK',                 55,  100),
  S('INDEX INTEGRITY ............. PASS',                     55,  100),
  S('CLOCK SYNC .................. FAIL',                     55,  100),
  S('CLOCK SYNC .................. FAIL',                     55,  450),
  S('CLOCK SYNC .................. ESTIMATED \u2014 UNKNOWN', 55,  450),
  B(200),
  S('WARNING: TIMESTAMP UNVERIFIED.',                         45,  200, 'warning'),
  S('PROCEEDING.',                                            80,  300),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 01 \u2014 DATABASE INIT]',                     35,  200, 'header'),
  B(200),
  S('VOCAL INDEX ................. LOADING',                  55,  100),
  S('VOCAL INDEX ................. LOADING',                  55,  450),
  S('VOCAL INDEX ................. READY',                    55,  450),
  B(200),
  S('SONG RECORDS ................ FOUND',                    55,  100),
  S('MASTER TABLE ................ LINKED',                   55,  100),
  S('STREAM LOG .................. LINKED',                   55,  100),
  B(200),
  S('DATABASE INIT ............... COMPLETE',                 55,  200),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 02 \u2014 SINGER LOOKUP]',                     35,  200, 'header'),
  B(200),
  S('QUERY: KISAKI',                                          50,  300),
  S('SEARCHING...',                                           60,  300),
  S('SEARCHING...',                                           60,  600),
  S('MATCH FOUND.',                                           55,  400),
  B(200),
  S('NAME ................. \u5996\u7396 / KISAKI',           45,  200),
  S('LABEL ................ RK Music',                        45,  100),
  S('TYPE ................. VSinger',                         45,  100),
  S('RECORDS .............. ACTIVE',                          45,  100),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 03 \u2014 ARCHIVE VERIFY]',                    35,  200, 'header'),
  B(200),
  S('VERIFYING SONG ENTRIES...',                              50,  300),
  S('  ENTRY COUNT ........ READING',                         45,  400),
  S('  ENTRY COUNT ........ READING',                         45,  500),
  S('  ENTRY COUNT ........ OK',                              45,  400),
  B(200),
  S('  DUPLICATES ......... NONE',                            45,  100),
  S('  MISSING FIELDS ..... NONE',                            45,  100),
  S('  MASTER LINKS ....... OK',                              45,  100),
  B(200),
  S('ARCHIVE VERIFY .............. COMPLETE',                 55,  200),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 04 \u2014 TRANSMISSION]',                      35,  200, 'header'),
  B(200),
  S('PREPARING MESSAGE...',                                   50,  300),
  S('ENCODING...................',                             60,  200),
  S('ENCODING...................',                             60,  500),
  S('READY.',                                                120,  400),
  B(300),
  S('TRANSMITTING IN 3...',                                   80,  400),
  S('             2...',                                      80, 1000),
  S('             1...',                                      80, 1000),
  B(500),
  S('TRANSMITTING.',                                         120,  300),
  B(500),
  SEP(),
  B(800),
  S('\u5996\u7396, every note is here.',                       90,  400, 'message'),
  S('\u5996\u7396, every note is here.',                       90, 1000, 'message'),
  B(500),
  S('This archive holds it all.',                             80,  400, 'message'),
  S('Each song you sang,',                                    80,  300, 'message'),
  S('remembered without end.',                                80,  200, 'message'),
  B(400),
  SEP(),
  B(300),
  S('TRANSMISSION COMPLETE.',                                 40,  200, 'status'),
  S('ARCHIVE STANDING BY...',                                 70,  300, 'status'),
]

interface DisplayedLine {
  text: string
  type: LineType
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export default function TerminalMessage() {
  const [displayedLines, setDisplayedLines] = useState<DisplayedLine[]>([])
  const [currentText,    setCurrentText]    = useState('')
  const [currentType,    setCurrentType]    = useState<LineType>('system')
  const [done,           setDone]           = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      for (const line of LINES) {
        if (cancelled) return

        await wait(line.preDelay)
        if (cancelled) return

        if (line.text === '') {
          setDisplayedLines(prev => [...prev, { text: '', type: 'blank' }])
          continue
        }

        setCurrentType(line.type)

        for (let c = 1; c <= line.text.length; c++) {
          if (cancelled) return
          setCurrentText(line.text.slice(0, c))
          if (c < line.text.length) await wait(line.speed)
        }

        if (cancelled) return
        setDisplayedLines(prev => [...prev, { text: line.text, type: line.type }])
        setCurrentText('')
      }

      if (!cancelled) setDone(true)
    }

    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [displayedLines, currentText])

  return (
    <div className="terminal-panel">
      <div className="terminal-scroll" ref={containerRef}>
      <div className="terminal-content">
        {displayedLines.map((line, i) => (
          <div key={i} className={`tl tl--${line.type}`}>
            {line.text || '\u00a0'}
          </div>
        ))}
        {!done && (
          <div className={`tl tl--${currentType} tl--active`}>
            {currentText}<span className="tl-cursor">_</span>
          </div>
        )}
        {done && (
          <div className="tl tl--status tl--active">
            <span className="tl-cursor">_</span>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
