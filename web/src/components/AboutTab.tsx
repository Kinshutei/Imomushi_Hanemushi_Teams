export default function AboutTab() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', lineHeight: 1.85, color: '#c0c0c0' }}>

      {/* ─── サイトについて ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>このサイトについて</h3>
        <p>
          このサイトはRK Music所属のVSinger <strong style={{ color: '#5fcf80' }}>妃玖（Kisaki）</strong>さんの
          歌ってみた・配信情報をまとめたファンメイドのデータベースサイトです。
        </p>
        <p>
          公式サイトではありませんので、掲載情報には誤りを含む場合がございますが、RK Music及び妃玖さんへのお問い合わせはなさらないようお願いいたします。ご質問等については、<a href="https://x.com/WL_GE_inn" target="_blank" rel="noopener noreferrer">白百合と金鷲亭(@WL_GE_inn)</a>まで訪ねください。
        </p>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          ※ 掲載情報は有志（若干1名）が手動で更新しています。
        </p>
      </section>

      {/* ─── 構築目的 ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>本サイトの構築目的</h3>
        <p>
          本サイトは個人が運営する情報発信サイトです。構築目的はこれらの情報発信を通じて活動を多くの方に知って頂き、またタレント・シンガー様のモチベーション向上に貢献出来ればとの想いから構築しております。
        </p>
      </section>

      {/* ─── タブの説明 ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>タブの使い方</h3>

        <div style={{ display: 'grid', gap: 12 }}>
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
              YouTube リンクから該当配信へ直接移動でき、楽曲名の右側のリンクからはその歌が始まるあたりへ飛べます！
            </p>
          </div>

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
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>データについて</h3>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.88rem',
          color: '#a0a0a0',
        }}>
          <tbody>
            {[
              ['データ形式', 'CSV（GitHubリポジトリで管理）'],
              ['更新タイミング', '歌枠終了後に手動更新'],
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
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>リンク</h3>
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
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>免責事項</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.8 }}>
          本サイトは個人が運営するものであり、RK Music様 および妃玖様とは無関係です。
          掲載情報の正確性は確保するよう務めておりますが、誤りを含む場合がございます。
          RK Music様及び妃玖様より、情報の削除を要請された場合は応じます。
        </p>
      </section>

    </div>
  )
}
