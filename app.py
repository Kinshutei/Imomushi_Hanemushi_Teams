import streamlit as st
import pandas as pd
import plotly.express as px
import sqlite3
import io
import os

DB_PATH = "utawaku.db"

CSV_COLUMNS = ["枠名", "楽曲名", "歌唱順", "配信日", "枠URL", "コラボ相手様", "原曲Artist", "作詞", "作曲"]

# ─────────────────────────────────────────
# DB初期化
# ─────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS streams (
            stream_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            stream_date DATE NOT NULL,
            archive_url TEXT,
            UNIQUE(title, stream_date)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS songs (
            song_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            artist      TEXT,
            lyricist    TEXT,
            composer    TEXT,
            UNIQUE(title)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS setlists (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            stream_id       INTEGER NOT NULL,
            song_id         INTEGER NOT NULL,
            order_in_stream INTEGER,
            song_url        TEXT,
            collab          TEXT,
            FOREIGN KEY (stream_id) REFERENCES streams(stream_id),
            FOREIGN KEY (song_id)   REFERENCES songs(song_id)
        )
    """)
    conn.commit()
    conn.close()

# ─────────────────────────────────────────
# DB操作ヘルパー
# ─────────────────────────────────────────
def get_conn():
    return sqlite3.connect(DB_PATH)

def fetch_df(query, params=()):
    conn = get_conn()
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df

def execute(query, params=()):
    conn = get_conn()
    conn.execute(query, params)
    conn.commit()
    conn.close()

# ─────────────────────────────────────────
# 認証ヘルパー
# ─────────────────────────────────────────
def check_password() -> bool:
    """
    サイドバーにパスワード入力UIを表示し、認証状態を返す。
    secrets に admin_password が未定義の場合はローカル開発とみなし常に True を返す。
    """
    if "admin_password" not in st.secrets:
        return True  # ローカル開発時はスルー

    if st.session_state.get("authenticated"):
        return True

    st.sidebar.divider()
    st.sidebar.markdown("#### 🔒 管理者ログイン")
    pw = st.sidebar.text_input("パスワード", type="password", key="pw_input")
    if st.sidebar.button("ログイン", use_container_width=True):
        if pw == st.secrets["admin_password"]:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.sidebar.error("パスワードが違います")
    return False

def logout_button():
    st.sidebar.divider()
    if st.sidebar.button("🔓 ログアウト", use_container_width=True):
        st.session_state["authenticated"] = False
        st.rerun()

# ─────────────────────────────────────────
# CSV エクスポート
# ─────────────────────────────────────────
def export_csv() -> bytes:
    df = fetch_df("""
        SELECT
            st.title           AS 枠名,
            sg.title           AS 楽曲名,
            sl.order_in_stream AS 歌唱順,
            st.stream_date     AS 配信日,
            sl.song_url        AS 枠URL,
            sl.collab          AS コラボ相手様,
            sg.artist          AS 原曲Artist,
            sg.lyricist        AS 作詞,
            sg.composer        AS 作曲
        FROM setlists sl
        JOIN streams st ON sl.stream_id = st.stream_id
        JOIN songs   sg ON sl.song_id   = sg.song_id
        ORDER BY st.stream_date, st.stream_id, sl.order_in_stream
    """)
    # 列が存在しない場合に備えて補完
    for col in CSV_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[CSV_COLUMNS]
    buf = io.StringIO()
    df.to_csv(buf, index=False, encoding="utf-8-sig")
    return buf.getvalue().encode("utf-8-sig")

# ─────────────────────────────────────────
# CSV インポート（完全上書き）
# ─────────────────────────────────────────
def import_csv(uploaded_file) -> tuple[bool, str]:
    try:
        raw = uploaded_file.read()
        for enc in ("utf-8-sig", "shift-jis", "utf-8"):
            try:
                df = pd.read_csv(io.BytesIO(raw), encoding=enc)
                break
            except Exception:
                continue
        else:
            return False, "文字コードを判別できませんでした（UTF-8 / Shift-JIS に対応しています）"

        missing = [c for c in CSV_COLUMNS if c not in df.columns]
        if missing:
            return False, f"必要な列が不足しています: {missing}"

        df = df[CSV_COLUMNS].copy()
        df["歌唱順"] = pd.to_numeric(df["歌唱順"], errors="coerce").fillna(0).astype(int)

        # 日付パース：「2026年2月22日」「2026/2/22」「2026-02-22」など複数形式に対応
        def parse_date(val):
            import re
            s = str(val).strip()
            # 「YYYY年M月D日」→「YYYY-MM-DD」に変換してからパース
            m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", s)
            if m:
                s = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
            return pd.to_datetime(s).strftime("%Y-%m-%d")

        df["配信日"] = df["配信日"].apply(parse_date)
        df["枠URL"] = df["枠URL"].fillna("")
        df["コラボ相手様"] = df["コラボ相手様"].fillna("なし")
        # 任意列：旧フォーマット（列なし）にも対応
        df["原曲Artist"] = df["原曲Artist"].fillna("") if "原曲Artist" in df.columns else ""
        df["作詞"]       = df["作詞"].fillna("")       if "作詞"       in df.columns else ""
        df["作曲"]       = df["作曲"].fillna("")       if "作曲"       in df.columns else ""

        conn = get_conn()
        c = conn.cursor()
        c.execute("DELETE FROM setlists")
        c.execute("DELETE FROM streams")
        c.execute("DELETE FROM songs")
        c.execute("DELETE FROM sqlite_sequence WHERE name IN ('setlists','streams','songs')")

        for _, row in df.iterrows():
            c.execute(
                "INSERT OR IGNORE INTO streams (title, stream_date, archive_url) VALUES (?,?,?)",
                (row["枠名"], row["配信日"], row["枠URL"] or None)
            )
            c.execute(
                "SELECT stream_id FROM streams WHERE title=? AND stream_date=?",
                (row["枠名"], row["配信日"])
            )
            stream_id = c.fetchone()[0]

            # 曲が未登録なら INSERT、登録済みなら artist/lyricist/composer を UPDATE
            c.execute(
                "INSERT OR IGNORE INTO songs (title, artist, lyricist, composer) VALUES (?,?,?,?)",
                (row["楽曲名"], row["原曲Artist"] or None, row["作詞"] or None, row["作曲"] or None)
            )
            c.execute("""
                UPDATE songs SET
                    artist   = COALESCE(NULLIF(?, ''), artist),
                    lyricist = COALESCE(NULLIF(?, ''), lyricist),
                    composer = COALESCE(NULLIF(?, ''), composer)
                WHERE title = ?
            """, (row["原曲Artist"], row["作詞"], row["作曲"], row["楽曲名"]))
            c.execute("SELECT song_id FROM songs WHERE title=?", (row["楽曲名"],))
            song_id = c.fetchone()[0]

            c.execute(
                "INSERT INTO setlists (stream_id, song_id, order_in_stream, song_url, collab) VALUES (?,?,?,?,?)",
                (stream_id, song_id, row["歌唱順"], row["枠URL"] or None, row["コラボ相手様"])
            )

        conn.commit()
        conn.close()
        return True, f"{len(df)} 件のレコードをインポートしました。"

    except Exception as e:
        return False, f"エラー: {e}"

# ─────────────────────────────────────────
# ページ：データ管理（認証必須）
# ─────────────────────────────────────────
def page_data_management():
    st.header("🔄 データ管理")

    if not check_password():
        st.info("👈 サイドバーからパスワードを入力してください。")
        return

    logout_button()

    col_ex, col_im = st.columns(2)

    with col_ex:
        st.subheader("📤 エクスポート")
        st.markdown("現在のDBの内容をCSV形式でダウンロードします。")
        csv_bytes = export_csv()
        st.download_button(
            label="⬇️ CSVダウンロード",
            data=csv_bytes,
            file_name="streaming_info.csv",
            mime="text/csv",
            use_container_width=True,
        )

    with col_im:
        st.subheader("📥 インポート（完全上書き）")
        st.warning(
            "⚠️ インポートすると既存データはすべて削除され、CSVの内容に置き換えられます。",
            icon="⚠️",
        )
        uploaded = st.file_uploader(
            "CSVファイルを選択（UTF-8 / Shift-JIS）",
            type=["csv"],
            key="import_csv",
        )
        if uploaded:
            if st.button("🔁 インポート実行", use_container_width=True, type="primary"):
                ok, msg = import_csv(uploaded)
                if ok:
                    st.success(msg)
                    st.rerun()
                else:
                    st.error(msg)

    st.divider()
    st.subheader("📋 CSVフォーマット")
    st.dataframe(
        pd.DataFrame({
            "列名": CSV_COLUMNS,
            "例": [
                "【初配信】初めまして、妃玖です。",
                "メビウス",
                "1",
                "2026-01-01",
                "https://www.youtube.com/live/xxxxx",
                "なし",
            ],
        }),
        use_container_width=True,
        hide_index=True,
    )

# ─────────────────────────────────────────
# ページ：配信枠
# ─────────────────────────────────────────
def page_streams():
    st.header("📋 配信枠一覧")

    streams_df = fetch_df("SELECT * FROM streams ORDER BY stream_date DESC")

    if streams_df.empty:
        st.info("配信枠がまだ登録されていません。")
        return

    streams_df.columns = ["ID", "枠名", "配信日", "アーカイブURL"]

    for _, row in streams_df.iterrows():
        label = f"**{row['配信日']}**　{row['枠名']}"
        with st.expander(label, expanded=False):
            setlist_df = fetch_df("""
                SELECT sl.order_in_stream AS 歌唱順,
                       s.title            AS 楽曲名,
                       sl.collab          AS コラボ相手様,
                       sl.song_url        AS 楽曲URL
                FROM setlists sl
                JOIN songs s ON sl.song_id = s.song_id
                WHERE sl.stream_id = ?
                ORDER BY sl.order_in_stream
            """, (int(row["ID"]),))

            if setlist_df.empty:
                st.info("この枠にはまだ曲が登録されていません。")
            else:
                st.dataframe(
                    setlist_df,
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        "楽曲URL": st.column_config.LinkColumn(
                            "楽曲URL",
                            display_text="▶ 開く",
                        )
                    }
                )

# ─────────────────────────────────────────
# ページ：曲
# ─────────────────────────────────────────
def page_songs():
    st.header("🎵 曲一覧 & 統計")

    count_df = fetch_df("""
        SELECT s.title       AS 楽曲名,
               s.artist      AS 原曲アーティスト,
               COUNT(sl.id)  AS 歌唱回数
        FROM songs s
        LEFT JOIN setlists sl ON s.song_id = sl.song_id
        GROUP BY s.song_id
        ORDER BY 歌唱回数 DESC
    """)

    if count_df.empty:
        st.info("曲がまだ登録されていません。")
        return

    st.dataframe(count_df, use_container_width=True, hide_index=True)

    st.subheader("歌唱回数ランキング（上位20曲）")
    top20 = count_df[count_df["歌唱回数"] > 0].head(20)
    if top20.empty:
        st.info("まだセトリにデータがありません。")
    else:
        fig = px.bar(
            top20,
            x="歌唱回数",
            y="楽曲名",
            orientation="h",
            color="歌唱回数",
            color_continuous_scale="Blues",
            hover_data=["原曲アーティスト"],
        )
        fig.update_layout(
            yaxis=dict(autorange="reversed"),
            coloraxis_showscale=False,
            height=max(400, len(top20) * 28),
        )
        st.plotly_chart(fig, use_container_width=True)

# ─────────────────────────────────────────
# メイン
# ─────────────────────────────────────────
def main():
    st.set_page_config(
        page_title="🐍妃玖 歌ってみたDB",
        page_icon="🎤",
        layout="wide"
    )
    init_db()

    # ─── グローバルCSS：コンパクト化 ───
    st.markdown("""
    <style>
    html, body, [class*="css"] { font-size: 14px !important; }
    h1 { font-size: 1.5rem !important; }
    h2 { font-size: 1.2rem !important; }
    h3 { font-size: 1.05rem !important; }
    .stDataFrame, .stDataFrame td, .stDataFrame th { font-size: 13px !important; }
    .streamlit-expanderHeader { font-size: 13px !important; }
    details summary p { font-size: 13px !important; }
    [data-testid="stSidebar"] * { font-size: 13px !important; }
    .stButton button, .stDownloadButton button { font-size: 13px !important; padding: 4px 12px !important; }
    .stAlert p { font-size: 13px !important; }
    p { line-height: 1.5 !important; }
    </style>
    """, unsafe_allow_html=True)

    BANNER_URL = (
        "https://yt3.googleusercontent.com/u3MLvApeviPLt_-RPfqiPB1ZPeEtaBknWDv-jKyzMGEijRaireQ2zfxK1HmkuDtJpUIW_uVXxEY"
        "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
    )
    st.image(BANNER_URL, use_container_width=True)
    st.title("🐍妃玖 歌ってみたDB")

    st.sidebar.markdown(
        """
        <div style="text-align:center; line-height:1.6; padding-bottom:8px;">
            <span style="font-size:1.05rem; font-weight:bold;">
                🐍⚜🎶芋虫羽虫㌠の部屋🎶⚜🐍
            </span><br>
            <span style="font-size:0.85rem; color:#aaa;">▼ menu</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

    page = st.sidebar.radio(
        label="",
        options=["配信枠", "曲一覧 & 統計", "データ管理"],
        format_func=lambda x: {
            "配信枠":        "📺 LiveStreaming Info",
            "曲一覧 & 統計": "🎵 Uta-Mita DB",
            "データ管理":    "🔄 Data Management",
        }[x],
    )

    if page == "配信枠":
        page_streams()
    elif page == "曲一覧 & 統計":
        page_songs()
    else:
        page_data_management()

if __name__ == "__main__":
    main()
