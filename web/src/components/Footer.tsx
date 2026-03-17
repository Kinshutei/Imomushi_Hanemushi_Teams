export default function Footer() {
  return (
    <footer style={{
      width: '100%',
      padding: '10px 20px',
      background: '#1a1a1a',
      borderTop: '1px solid #242424',
      textAlign: 'center',
      fontSize: '12px',
      color: '#484848',
      letterSpacing: '0.04em',
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      このサイトは{' '}
      <a
        href="https://x.com/WL_GE_inn"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#585858', textDecoration: 'none' }}
      >
        kinshutei
      </a>
      {' '}により作成されています
    </footer>
  )
}
