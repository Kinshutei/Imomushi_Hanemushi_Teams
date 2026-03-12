export default function AboutTab() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', lineHeight: 1.85, color: '#c0c0c0' }}>

      {/* ─── サイトについて ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3>このサイトについて</h3>
        <p>
          このサイトは VTuber / VSinger <strong style={{ color: '#5fcf80' }}>妃玖（Kisaki）</strong> の
          歌ってみた・配信情報をまとめたファンメイドのデータベースサイトです。
          公式サイトではありません。
        </p>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          ※ 掲載情報は有志が手動で更新しています。最新情報は妃玖の公式チャンネルをご確認ください。
        </p>
      </section>

      {/* ─── タブの説明 ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3>タブの使い方</h3>

        <div style={{ display: 'grid', gap: 12 }}>
          {/* LiveStreaming Info */}
          <div style={{
            background: '#161616',
            border: '1px solid #222',
            borderRadius: 8,
            padding: '14px 18px',
          }}>
            <div style={{ fontWeight: 700, color: '#5fcf80', marginBottom: 6, fontSize: '0.95rem' }}>
              🎙 LiveStreaming Info
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#a0a0a0' }}>
              歌枠・配信ごとのセットリスト一覧です。配信日・枠名でグループ化され、
              各枠をクリックすると歌唱曲リストが展開します。
              YouTube リンクから該当配信へ直接移動できます。
            </p>
          </div>

          {/* Uta-Mita DB */}
          <div style={{
            background: '#161616',
            border: '1px solid #222',
            borderRadius: 8,
            padding: '14px 18px',
          }}>
            <div style={{ fontWeight: 700, color: '#5fcf80', marginBottom: 6, fontSize: '0.95rem' }}>
              🎵 Uta-Mita DB
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#a0a0a0' }}>
              楽曲ごとの集計データです。列ヘッダーをクリックするとその列でソートできます。
              下部のグラフで歌唱回数ランキング・リリース年度分布・原曲アーティスト分布を確認できます。
            </p>
          </div>
        </div>
      </section>

      {/* ─── データについて ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3>データについて</h3>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.88rem',
          color: '#a0a0a0',
        }}>
          <tbody>
            {[
              ['データ形式', 'CSV（GitHubリポジトリで管理）'],
              ['更新タイミング', '歌枠開催後に手動更新'],
              ['収録範囲', '妃玖の歌枠・歌ってみた動画'],
              ['コラボ枠', 'コラボ相手様の名前も記録しています'],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #1e1e1e',
                  color: '#606060',
                  whiteSpace: 'nowrap',
                  width: 160,
                }}>{k}</td>
                <td style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #1e1e1e',
                }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ─── リンク ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3>リンク</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href="https://www.youtube.com/@kisaki_rkmusic"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#5fcf80', fontSize: '0.95rem' }}
          >
            ▶ 妃玖 YouTube チャンネル
          </a>
          <a
            href="https://twitter.com/kisaki_rkmusic"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#5fcf80', fontSize: '0.95rem' }}
          >
            𝕏 妃玖 X（Twitter）
          </a>
        </div>
      </section>

      {/* ─── 免責事項 ─── */}
      <section>
        <h3>免責事項</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.8 }}>
          本サイトはファンが個人で運営するものであり、RK Music および妃玖本人とは無関係です。
          掲載情報の正確性は保証しません。誤りや削除依頼がある場合はお知らせください。
        </p>
      </section>

    </div>
  )
}
