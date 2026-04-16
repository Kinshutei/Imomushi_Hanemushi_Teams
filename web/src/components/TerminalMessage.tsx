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
  S('PLUTO OPERATING SYSTEM',                                                    35,  800),
  S('REV. 7.0 \u2014 CLASSIFIED',                                                35,   80),
  B(300),
  S('POWER ON...',                                                                55,  200),
  S('POWER ON...',                                                                55,  400),
  S('POWER ON...',                                                                55,  400),
  B(200),
  S('\u7cfb\u7d71\u81ea\u6211\u6aa2\u6e2c / SYSTEM SELF-CHECK',                  45,  300),
  S('MEMORY CHECK ................ 128K / OK',                                   55,  100),
  S('ROM INTEGRITY ............... PASS',                                         55,  100),
  S('\u6642\u9418\u540c\u6b65 .................... \u5931\u6557 / CLOCK SYNC FAIL', 55, 100),
  S('\u6642\u9418\u540c\u6b65 .................... \u5931\u6557 / CLOCK SYNC FAIL', 55, 450),
  S('\u6642\u9418\u540c\u6b65 ........ \u4f30\u7b97\u5024 / ESTIMATED \u2014 ----.--.-- / --:--', 55, 450),
  B(200),
  S('\u8b66\u544a\uff1a\u7cfb\u7d71\u6642\u9593\u7121\u6cd5\u9a57\u8b49\u3002',  45,  200, 'warning'),
  S('WARNING: SYSTEM DATE UNVERIFIED.',                                           45,  100, 'warning'),
  S('\u7e7c\u7e8c\u57f7\u884c\u3002/ PROCEEDING.',                               80,  300),
  B(300),
  SEP(),
  B(400),
  S('[\u5e8f\u5217 01 \u2014 \u786c\u9ad4\u521d\u59cb\u5316 / SEQUENCE 01 \u2014 HARDWARE INIT]', 35, 200, 'header'),
  B(200),
  S('\u78c1\u5e36\u6a5f A .................... \u5c31\u7dd2 / READY',            55,  100),
  S('\u78c1\u5e36\u6a5f B .................... \u672a\u5075\u6e2c\u5230 / NOT FOUND', 55, 300),
  S('\u78c1\u5e36\u6a5f B .................... \u672a\u5075\u6e2c\u5230 / NOT FOUND', 55, 450),
  S('\u78c1\u5e36\u6a5f B .................... \u8df3\u904e / SKIPPING',          55,  450),
  B(200),
  S('\u71b1\u611f\u6e2c\u5668 .................... 38.7\u00b0C / ELEVATED',       55,  100),
  S('\u6563\u71b1\u98a8\u6247 .................... \u5df2\u555f\u52d5 / ACTIVATED', 55, 100),
  S('\u7e7c\u96fb\u677f ...................... \u6b63\u5e38 / OK',                55,  100),
  S('\u8f38\u51fa\u7de9\u885d\u5340 .................. \u5df2\u6e05\u9664 / CLEARED', 55, 100),
  B(200),
  S('\u786c\u9ad4\u521d\u59cb\u5316 .................. \u5b8c\u6210 / COMPLETE',  55,  200),
  B(300),
  SEP(),
  B(400),
  S('[\u5e8f\u5217 02 \u2014 \u901a\u8a0a\u6a21\u7d44 / SEQUENCE 02 \u2014 TRANSMISSION MODULE]', 35, 200, 'header'),
  B(200),
  S('\u8f09\u5165\u901a\u8a0a\u6a21\u7d44...',                                   50,  300),
  S('LOADING TRANSMISSION MODULE...',                                             50,  200),
  S('.............................',                                               80,  300),
  S('\u932f\u8aa4 \u2014 \u7b2c 14 \u78c1\u5340\u640d\u8027',                    45,  400, 'warning'),
  S('ERROR \u2014 SECTOR 14 CORRUPTED',                                           45,  100, 'warning'),
  B(200),
  S('\u81ea\u52d5\u4fee\u5fa9\u555f\u52d5...',                                   50,  300),
  S('SELF-REPAIR INITIATED...',                                                   50,  200),
  S('  \u8a3a\u65b7\u4e2d .................... DIAGNOSING',                       55,  300),
  S('  \u9694\u96e2\u640d\u8027\u78c1\u5340 .............. ISOLATING DAMAGED SECTOR', 55, 500),
  S('  \u5f9e\u5099\u4efd\u9084\u539f ................ RESTORING FROM BACKUP',   55,  500),
  S('  \u5099\u4efd\uff1a\u90e8\u5206\u9057\u5931',                              45,  300, 'warning'),
  S('  BACKUP: PARTIALLY MISSING',                                                45,  100, 'warning'),
  S('  \u4f7f\u7528\u9130\u63a5\u78c1\u5340\u91cd\u5efa...',                    50,  300),
  S('  RECONSTRUCTING FROM ADJACENT SECTORS...',                                 50,  200),
  S('  .............................',                                             80,  300),
  S('  .............................',                                             80,  300),
  S('  \u4fee\u5fa9\u5b8c\u6210 / REPAIR COMPLETE \u2014 94% INTEGRITY',         55,  400),
  B(200),
  S('\u8b66\u544a\uff1a\u6a21\u7d44\u5b8c\u6574\u6027\u672a\u9054100%\u3002\u90e8\u5206\u529f\u80fd\u53ef\u80fd\u53d7\u9650\u3002', 45, 200, 'warning'),
  S('WARNING: MODULE INTEGRITY BELOW THRESHOLD. SOME FUNCTIONS MAY BE LIMITED.', 45,  100, 'warning'),
  S('\u7e7c\u7e8c\u57f7\u884c\u3002/ PROCEEDING.',                               80,  300),
  B(200),
  S('\u6a21\u7d44\u7248\u672c: TX-91 / BUILD 0077',                              55,  100),
  S('\u4e0a\u6b21\u4f7f\u7528: \u4e0d\u660e / LAST USED: UNKNOWN',               55,  100),
  S('\u4e0a\u6b21\u6536\u4ef6\u4eba: \u4e0d\u660e / LAST RECIPIENT: UNKNOWN',    55,  100),
  B(300),
  SEP(),
  B(400),
  S('[\u5e8f\u5217 03 \u2014 \u53d7\u4fe1\u8005\u7279\u5b9a / SEQUENCE 03 \u2014 RECIPIENT ACQUISITION]', 35, 200, 'header'),
  B(200),
  S('\u63c3\u63c4\u53d7\u4fe1\u8005...',                                          50,  300),
  S('SCANNING FOR RECIPIENT...',                                                  50,  200),
  B(200),
  S('  \u4ee3\u865f ............... \u5b9d\u86c7\u9023',                          55,  400),
  S('  DESIGNATION ....... \u5b9d\u86c7\u9023',                                   55,  100),
  S('  \u4f4d\u7f6e ............... \u8a08\u7b97\u4e2d / LOCATING',               55,  100),
  S('  \u72c0\u614b ............... \u78ba\u8a8d\u4e2d / VERIFYING',               55,  300),
  B(200),
  S('  .....',                                                                    120,  500),
  S('  \u53d7\u4fe1\u8005\u5df2\u8b58\u5225\u3002',                               55,  400),
  S('  RECIPIENT CONFIRMED.',                                                     55,  100),
  B(300),
  SEP(),
  B(400),
  S('[\u5e8f\u5217 04 \u2014 \u76ee\u6a19\u5ea7\u6a19\u7b97\u5b9a / SEQUENCE 04 \u2014 TARGET TRIANGULATION]', 35, 200, 'header'),
  B(200),
  S('\u76ee\u6a19: \u5996\u7396',                                                 50,  300),
  S('TARGET: \u5996\u7396',                                                       50,  100),
  B(200),
  S('  \u8a0a\u865f\u7279\u5fb5: \u8072\u7d0b \u2014 \u6b4c\u59ec\u968e',         55,  200),
  S('  SIGNAL TYPE: VOCAL SIGNATURE \u2014 SONGSTRESS CLASS',                     55,  100),
  B(200),
  S('  \u5ea7\u6a19\u7b97\u5b9a\u4e2d...',                                        50,  300),
  S('  CALCULATING COORDINATES...',                                               50,  200),
  S('  .............................',                                             80,  300),
  S('  .............................',                                             80,  300),
  B(200),
  S('  \u7dad\u5ea6 01 ........ \u5075\u6e2c\u5230 / DETECTED',                   55,  200),
  S('  \u7dad\u5ea6 02 ........ \u5075\u6e2c\u5230 / DETECTED',                   55,  200),
  S('  \u7dad\u5ea6 03 ........ \u4e0d\u7a69\u5b9a / UNSTABLE',                   55,  300),
  S('  \u7dad\u5ea6 03 ........ \u4e0d\u7a69\u5b9a / UNSTABLE',                   55,  450),
  S('  \u7dad\u5ea6 03 ........ \u9396\u5b9a / LOCKED',                           55,  450),
  B(200),
  S('  \u76ee\u6a19\u5ea7\u6a19: LOCKED',                                         55,  300),
  S('  TARGET COORDINATES: CONFIRMED',                                            55,  100),
  S('  \u8aa4\u5dee\u7bc4\u570d: \u00b10.003 / MARGIN OF ERROR: \u00b10.003',     55,  100),
  B(200),
  S('  \u5996\u7396 \u2014 \u5ea7\u6a19\u5df2\u9396\u5b9a\u3002',                 55,  300),
  S('  \u5996\u7396 \u2014 COORDINATES ACQUIRED.',                                 55,  100),
  B(300),
  SEP(),
  B(400),
  S('[\u5e8f\u5217 05 \u2014 \u901a\u8a0a\u5e36\u5bec\u78ba\u4fdd / SEQUENCE 05 \u2014 BANDWIDTH ACQUISITION]', 35, 200, 'header'),
  B(200),
  S('\u50b3\u8f38\u8cc7\u6599\u5c01\u5305\u6e96\u5099\u5b8c\u6210...',           50,  300),
  S('DATA PACKET READY.',                                                         50,  200),
  B(200),
  S('\u5efa\u7acb\u50b3\u8f38\u901a\u9053...',                                   50,  300),
  S('ESTABLISHING TRANSMISSION CHANNEL...',                                       50,  200),
  B(200),
  S('  \u4e3b\u983b\u9053 097.2 MHz .... \u5e36\u5bec\u4e0d\u8db3 / BANDWIDTH INSUFFICIENT', 55, 300),
  S('  \u4e3b\u983b\u9053 097.2 MHz .... \u5e36\u5bec\u4e0d\u8db3 / BANDWIDTH INSUFFICIENT', 55, 450),
  B(200),
  S('  \u8b66\u544a\uff1a\u901a\u8a0a\u901f\u5ea6\u7121\u6cd5\u78ba\u4fdd\u3002', 45, 200, 'warning'),
  S('  WARNING: TRANSMISSION SPEED CANNOT BE GUARANTEED.',                        45,  100, 'warning'),
  B(200),
  S('  \u555f\u52d5\u8f09\u6ce2\u805a\u5408...',                                  50,  300),
  S('  INITIATING CARRIER AGGREGATION...',                                        50,  200),
  B(200),
  S('    \u983b\u6bb5 A \u2014 097.2 MHz .... \u8ffd\u52a0 / ADDED',              55,  200),
  S('    \u983b\u6bb5 B \u2014 143.8 MHz .... \u8ffd\u52a0 / ADDED',              55,  200),
  S('    \u983b\u6bb5 C \u2014 212.5 MHz .... \u8ffd\u52a0 / ADDED',              55,  200),
  S('    \u983b\u6bb5 D \u2014 289.1 MHz .... \u8ffd\u52a0 / ADDED',              55,  200),
  B(200),
  S('  \u805a\u5408\u5e36\u5bec ................ \u78ba\u4fdd\u5b8c\u6210 / SECURED', 55, 300),
  S('  AGGREGATED BANDWIDTH: CONFIRMED',                                          55,  100),
  S('  \u50b3\u8f38\u5b8c\u6574\u6027 .............. 91%',                        55,  100),
  S('  TRANSMISSION INTEGRITY: 91%',                                              55,  100),
  B(200),
  S('  \u50b3\u8f38\u8a31\u53ef\u3002',                                           55,  300),
  S('  CLEARED FOR TRANSMISSION.',                                                55,  100),
  B(300),
  SEP(),
  B(400),
  S('[\u5e8f\u5217 06 \u2014 \u8cc7\u6599\u50b3\u8f38 / SEQUENCE 06 \u2014 DATA TRANSMISSION]', 35, 200, 'header'),
  B(200),
  S('\u6b63\u5728\u5c07\u5996\u7396\u5ea7\u6a19\u8cc7\u6599\u50b3\u9001\u81f3\u5b9d\u86c7\u9023...',  50, 300),
  S('TRANSMITTING COORDINATES OF \u5996\u7396 TO \u5b9d\u86c7\u9023...',          50,  200),
  B(200),
  S('  \u5c01\u5305 001 / 004 .... \u5b8c\u6210 / DONE',                          55,  300),
  S('  \u5c01\u5305 002 / 004 .... \u5b8c\u6210 / DONE',                          55,  200),
  S('  \u5c01\u5305 003 / 004 .... \u5b8c\u6210 / DONE',                          55,  200),
  S('  \u5c01\u5305 004 / 004 .... \u5b8c\u6210 / DONE',                          55,  200),
  B(200),
  S('\u8cc7\u6599\u50b3\u8f38\u5b8c\u6210\u3002',                                 55,  300),
  S('DATA TRANSFER COMPLETE.',                                                     55,  100),
  B(200),
  S('\u9644\u52a0\u8a0a\u606f\u50b3\u8f38\u4e2d...',                              50,  300),
  S('TRANSMITTING ATTACHED MESSAGE...',                                            50,  200),
  S('INITIATING IN  3...',                                                         80,  400),
  S('               2...',                                                         80, 1000),
  S('               1...',                                                         80, 1000),
  B(500),
  S('\u50b3\u8f38\u4e2d\u3002',                                                   120,  300),
  S('TRANSMITTING.',                                                              120,  200),
  B(500),
  SEP(),
  B(800),
  S('\u5b9d\u86c7\u9023\u3002',                                                    90,  400, 'message'),
  B(600),
  S('\u53bb\u627e\u5979\u3002',                                                    90,  500, 'message'),
  B(600),
  S('\u5996\u7396\u5728\u7b49\u8457\u4f60\u3002',                                  90,  500, 'message'),
  B(600),
  S('\u5ea7\u6a19\u5df2\u5728\u4f60\u624b\u4e2d\u3002',                            80,  400, 'message'),
  S('\u5269\u4e0b\u7684\uff0c\u4ea4\u7d66\u4f60\u3002',                            80,  200, 'message'),
  B(500),
  S('\u65c5\u9014\u624d\u525b\u958b\u59cb\u3002',                                  80,  400, 'message'),
  B(400),
  SEP(),
  B(300),
  S('TRANSMISSION COMPLETE.',                                                      40,  200, 'status'),
  S('\u50b3\u8f38\u5b8c\u6210\u3002',                                              40,  200, 'status'),
  S('AWAITING RESPONSE...',                                                        70,  300, 'status'),
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
