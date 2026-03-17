export default function Footer() {
  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '7px 20px',
      background: '#161616',
      borderTop: '1px solid #222',
      textAlign: 'center',
      fontSize: '11px',
      color: '#707070',
      letterSpacing: '0.06em',
      fontFamily: "'Noto Sans JP', sans-serif",
      zIndex: 200,
    }}>
      © 2026{' '}
      <a
        href="https://x.com/WL_GE_inn"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#888', textDecoration: 'none' }}
      >
        kinshutei
      </a>
      {'　|　'}非公式ファンサイト — 妃玖（Kisaki / RKmusic）{'　|　'}
      掲載情報の誤りは{' '}
      <a
        href="https://x.com/WL_GE_inn"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#888', textDecoration: 'none' }}
      >
        @WL_GE_inn
      </a>
      {' '}までお気軽にどうぞ
    </footer>
  )
}
