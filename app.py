import streamlit as st
import pandas as pd
import plotly.express as px
import io
import base64
import requests

# ─────────────────────────────────────────
# 定数
# ─────────────────────────────────────────
CSV_COLUMNS = ["枠名", "楽曲名", "歌唱順", "配信日", "枠URL", "コラボ相手様", "原曲Artist", "作詞", "作曲", "リリース日"]

# ─────────────────────────────────────────
# GitHub ヘルパー
# ─────────────────────────────────────────
def _gh_secrets_ok() -> bool:
    required = ["github_token", "github_repo", "github_csv_path"]
    return all(k in st.secrets for k in required)

def _gh_headers() -> dict:
    return {
        "Authorization": f"Bearer {st.secrets['github_token']}",
        "Accept": "application/vnd.github+json",
    }

def _gh_branch() -> str:
    return st.secrets.get("github_branch", "main")

def load_df() -> pd.DataFrame:
    """GitHubからCSVを読み込んでDataFrameを返す。secrets未設定時はローカルフォールバック。"""
    empty = pd.DataFrame(columns=CSV_COLUMNS)

    if not _gh_secrets_ok():
        # ローカル開発用：カレントディレクトリの streaming_info.csv を読む
        try:
            df = pd.read_csv("streaming_info.csv", encoding="utf-8-sig")
            return _normalize_df(df)
        except FileNotFoundError:
            return empty

    repo  = st.secrets["github_repo"]
    path  = st.secrets["github_csv_path"]
    branch = _gh_branch()
    url   = f"https://api.github.com/repos/{repo}/contents/{path}?ref={branch}"

    try:
        res = requests.get(url, headers=_gh_headers(), timeout=10)
        if res.status_code == 404:
            return empty
        res.raise_for_status()
        content = base64.b64decode(res.json()["content"])
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
        return _normalize_df(df)
    except Exception as e:
        st.warning(f"GitHubからのデータ読み込みに失敗しました: {e}")
        return empty

def push_df(df: pd.DataFrame, commit_msg: str = "Update streaming data") -> tuple[bool, str]:
    """DataFrameをCSVとしてGitHubにコミットする。"""
    if not _gh_secrets_ok():
        # ローカル：ファイルに保存するだけ
        df.to_csv("streaming_info.csv", index=False, encoding="utf-8-sig")
        return True, "ローカルファイルに保存しました。"

    repo   = st.secrets["github_repo"]
    path   = st.secrets["github_csv_path"]
    branch = _gh_branch()
    url    = f"https://api.github.com/repos/{repo}/contents/{path}"

    try:
        # 既存ファイルのSHAを取得（更新に必要）
        res = requests.get(f"{url}?ref={branch}", headers=_gh_headers(), timeout=10)
        sha = res.json().get("sha") if res.status_code == 200 else None

        csv_bytes = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
        payload = {
            "message": commit_msg,
            "content": base64.b64encode(csv_bytes).decode(),
            "branch":  branch,
        }
        if sha:
            payload["sha"] = sha

        res = requests.put(url, headers=_gh_headers(), json=payload, timeout=15)
        res.raise_for_status()
        return True, "GitHubにコミットしました。"
    except Exception as e:
        return False, f"GitHubへのコミットに失敗しました: {e}"

def _normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    """型の正規化・欠損補完。"""
    for col in CSV_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[CSV_COLUMNS].copy()
    df["歌唱順"] = pd.to_numeric(df["歌唱順"], errors="coerce").fillna(0).astype(int)
    df["配信日"] = df["配信日"].apply(_parse_date)
    df["コラボ相手様"] = df["コラボ相手様"].fillna("なし").astype(str)
    for col in ["枠URL", "原曲Artist", "作詞", "作曲"]:
        df[col] = df[col].fillna("").astype(str)
    df["リリース日"] = df["リリース日"].apply(lambda v: "" if pd.isna(v) or str(v).strip() in ("", "nan", "NaN") else str(v).strip())
    return df

def _parse_date(val) -> str:
    import re
    s = str(val).strip()
    m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", s)
    if m:
        s = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    try:
        return pd.to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return s

# ─────────────────────────────────────────
# 認証ヘルパー
# ─────────────────────────────────────────
def check_password() -> bool:
    if "admin_password" not in st.secrets:
        return True
    if st.session_state.get("authenticated"):
        return True

    st.divider()
    st.markdown("#### 🔒 管理者ログイン")
    pw = st.text_input("パスワード", type="password", key="pw_input")
    if st.button("ログイン", use_container_width=False):
        if pw == st.secrets["admin_password"]:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.error("パスワードが違います")
    return False

def logout_button():
    if st.button("🔓 ログアウト"):
        st.session_state["authenticated"] = False
        st.rerun()

# ─────────────────────────────────────────
# ページ：配信枠
# ─────────────────────────────────────────
def page_streams(df: pd.DataFrame):


    if df.empty:
        st.info("配信枠がまだ登録されていません。")
        return

    streams = (
        df[["枠名", "配信日", "枠URL"]]
        .drop_duplicates(subset=["枠名", "配信日"])
        .sort_values("配信日", ascending=False)
        .reset_index(drop=True)
    )

    for _, row in streams.iterrows():
        label = f"**{row['配信日']}**　{row['枠名']}"
        with st.expander(label, expanded=False):
            setlist = (
                df[df["枠名"] == row["枠名"]]
                [["歌唱順", "楽曲名", "コラボ相手様", "枠URL"]]
                .sort_values("歌唱順")
                .rename(columns={"枠URL": "楽曲URL"})
                .reset_index(drop=True)
            )
            if setlist.empty:
                st.info("この枠にはまだ曲が登録されていません。")
            else:
                st.dataframe(
                    setlist,
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
# ページ：曲一覧 & 統計
# ─────────────────────────────────────────
def page_songs(df: pd.DataFrame):


    if df.empty:
        st.info("曲がまだ登録されていません。")
        return

    # 曲ごとに集計（作詞・作曲・アーティストは最初の非空値を使う）
    count_df = (
        df.groupby("楽曲名", as_index=False)
        .agg(
            原曲アーティスト=("原曲Artist", lambda x: next((v for v in x if v), "")),
            作詞=("作詞", lambda x: next((v for v in x if v), "")),
            作曲=("作曲", lambda x: next((v for v in x if v), "")),
            リリース日=("リリース日", lambda x: next((v for v in x if v), "")),
            歌唱回数=("楽曲名", "count"),
        )
        .sort_values("歌唱回数", ascending=False)
        .reset_index(drop=True)
    )

    # リリース日からリリース年を導出（yyyy年形式）
    def to_release_year(val):
        v = str(val).strip()
        if not v or v in ("nan", "NaN", ""):
            return ""
        # 「yyyy年m月d日」形式を変換してからパース
        import re
        m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", v)
        if m:
            v = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        try:
            return f"{pd.to_datetime(v).year}年"
        except Exception:
            return ""
    count_df["リリース年"] = count_df["リリース日"].apply(to_release_year)
    # 列順を整える：リリース日の直後にリリース年を配置
    cols = list(count_df.columns)
    if "リリース年" in cols and "リリース日" in cols:
        cols.remove("リリース年")
        idx = cols.index("リリース日") + 1
        cols.insert(idx, "リリース年")
        count_df = count_df[cols]

    st.dataframe(count_df, use_container_width=True, hide_index=True)

    st.subheader("歌唱回数ランキング（上位20曲）")
    top20 = count_df[count_df["歌唱回数"] > 0].head(20)
    if top20.empty:
        st.info("まだデータがありません。")
    else:
        top20 = top20.copy()
        max_count = top20["歌唱回数"].max()
        # セージグリーン系：薄い(#c8ddc8)〜やや濃い(#6a9e6a)
        top20["_c"] = top20["歌唱回数"].apply(
            lambda v: f"rgba(100,158,100,{0.25 + 0.55 * v / max_count})"
        )
        fig = px.bar(
            top20,
            x="歌唱回数",
            y="楽曲名",
            orientation="h",
            text="歌唱回数",
            hover_data=["原曲アーティスト", "作詞", "作曲"],
        )
        fig.update_traces(
            marker_color=top20["_c"].tolist(),
            marker_line_width=0,
            textposition="outside",
            textfont=dict(size=11, color="#888888"),
        )
        fig.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#555555", size=12),
            yaxis=dict(
                autorange="reversed",
                showgrid=False,
                tickfont=dict(size=11, color="#666666"),
            ),
            xaxis=dict(
                showgrid=True,
                gridcolor="rgba(0,0,0,0.06)",
                zeroline=False,
                tickfont=dict(size=10, color="#888888"),
            ),
            coloraxis_showscale=False,
            height=max(380, len(top20) * 26),
            margin=dict(l=10, r=55, t=16, b=10),
        )
        st.plotly_chart(fig, use_container_width=True)

    # ── リリース年度分布ツリーマップ ──
    st.subheader("リリース年度分布")
    treemap_df = (
        count_df[count_df["リリース年"].str.len() > 0]
        .groupby("リリース年", as_index=False)
        .agg(曲数=("楽曲名", "count"))
        .sort_values("リリース年")
    )
    if treemap_df.empty:
        st.info("リリース年データがまだありません。")
    else:
        fig_tree = px.treemap(
            treemap_df,
            path=["リリース年"],
            values="曲数",
            color="曲数",
            color_continuous_scale=[
                [0.0, "#e8f2e8"],
                [0.4, "#c0d8c0"],
                [0.7, "#92bc92"],
                [1.0, "#6a9e6a"],
            ],
        )
        fig_tree.update_traces(
            texttemplate="<b>%{label}</b><br>%{value}曲",
            textfont=dict(size=13, color="#3a3a3a"),
            marker=dict(
                line=dict(width=2, color="#ffffff"),
                pad=dict(t=22, l=4, r=4, b=4),
            ),
            hovertemplate="<b>%{label}</b><br>%{value}曲<extra></extra>",
        )
        fig_tree.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#555555"),
            coloraxis_showscale=False,
            margin=dict(t=4, l=0, r=0, b=0),
            height=380,
        )
        st.plotly_chart(fig_tree, use_container_width=True)

# ─────────────────────────────────────────
# ページ：データ管理（認証必須）
# ─────────────────────────────────────────
def page_data_management(df: pd.DataFrame):


    if not check_password():
        return

    logout_button()

    col_ex, col_im = st.columns(2)

    # ── エクスポート ──
    with col_ex:
        st.subheader("📤 エクスポート")
        st.markdown("現在のデータをCSV形式でダウンロードします。")
        csv_bytes = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
        st.download_button(
            label="⬇️ CSVダウンロード",
            data=csv_bytes,
            file_name="streaming_info.csv",
            mime="text/csv",
            use_container_width=True,
        )

    # ── インポート ──
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
                raw = uploaded.read()
                new_df = None
                for enc in ("utf-8-sig", "cp932", "utf-8"):
                    try:
                        new_df = pd.read_csv(io.BytesIO(raw), encoding=enc)
                        break
                    except Exception:
                        continue

                if new_df is None:
                    st.error("文字コードを判別できませんでした。")
                else:
                    missing = [c for c in ["枠名", "楽曲名", "歌唱順", "配信日"] if c not in new_df.columns]
                    if missing:
                        st.error(f"必要な列が不足しています: {missing}")
                    else:
                        new_df = _normalize_df(new_df)
                        ok, msg = push_df(new_df, commit_msg="Update: CSV import via app")
                        if ok:
                            st.success(f"{len(new_df)} 件をインポートし、GitHubにコミットしました。")
                            st.cache_data.clear()
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
                "柊キライ",
                "柊キライ",
                "柊キライ",
                "2021-03-15",
            ],
        }),
        use_container_width=True,
        hide_index=True,
    )

# ─────────────────────────────────────────
# データ読み込み（キャッシュ付き）
# ─────────────────────────────────────────
@st.cache_data(ttl=60)
def get_data() -> pd.DataFrame:
    return load_df()

def debug_github():
    """GitHub接続の診断情報を表示する（一時的なデバッグ用）。"""
    st.subheader("🔍 GitHub接続診断")
    if not _gh_secrets_ok():
        st.error("secrets に github_token / github_repo / github_csv_path が設定されていません。")
        return

    repo   = st.secrets["github_repo"]
    path   = st.secrets["github_csv_path"]
    branch = _gh_branch()

    st.code(f"repo:   {repo}\npath:   {path}\nbranch: {branch}")

    url = f"https://api.github.com/repos/{repo}/contents/{path}?ref={branch}"
    try:
        res = requests.get(url, headers=_gh_headers(), timeout=10)
        st.write(f"HTTPステータス: **{res.status_code}**")
        if res.status_code == 200:
            info = res.json()
            st.success(f"✅ ファイル発見！サイズ: {info.get('size')} bytes")
        elif res.status_code == 404:
            st.error("❌ ファイルが見つかりません。パスまたはブランチ名を確認してください。")
            # リポジトリのルート一覧を表示
            root_url = f"https://api.github.com/repos/{repo}/contents/?ref={branch}"
            root_res = requests.get(root_url, headers=_gh_headers(), timeout=10)
            if root_res.status_code == 200:
                files = [f["name"] for f in root_res.json() if isinstance(root_res.json(), list)]
                st.write("リポジトリのルートにあるファイル一覧:")
                st.write(files)
        elif res.status_code == 401:
            st.error("❌ 認証エラー。github_token が無効または期限切れです。")
        else:
            st.error(f"❌ 予期しないエラー: {res.text[:300]}")
    except Exception as e:
        st.error(f"接続エラー: {e}")

# ─────────────────────────────────────────
# メイン
# ─────────────────────────────────────────
def main():
    st.set_page_config(
        page_title="妃玖 歌ってみたDB",
        page_icon="🐍",
        layout="wide"
    )

    BANNER_URL = (
        "https://yt3.googleusercontent.com/u3MLvApeviPLt_-RPfqiPB1ZPeEtaBknWDv-jKyzMGEijRaireQ2zfxK1HmkuDtJpUIW_uVXxEY"
        "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
    )

    # ─── グローバルCSS ───
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap');
    html, body, [class*="css"] { font-family: 'Noto Sans JP', sans-serif !important; font-size: 14px !important; }
    h1 { font-size: 1.5rem !important; }
    h2 { font-size: 1.2rem !important; }
    h3 { font-size: 1.05rem !important; }
    .stDataFrame, .stDataFrame td, .stDataFrame th { font-size: 13px !important; }
    .streamlit-expanderHeader { font-size: 13px !important; }
    details summary p { font-size: 13px !important; }
    .stButton button, .stDownloadButton button { font-size: 13px !important; padding: 4px 12px !important; }
    .stAlert p { font-size: 13px !important; }
    p { line-height: 1.5 !important; }
    /* ヘッダーバナー：画面幅いっぱい・余白なし */
    .banner-wrap { margin: -4rem -4rem 0 -4rem; line-height: 0; }
    .banner-wrap img { width: 100%; display: block; max-height: 220px; object-fit: cover; }
    /* タブのフォントサイズ */
    [data-testid="stTabs"] button p { font-size: 1.1rem !important; font-weight: bold !important; }
    /* expander */
    details summary:hover { background-color: rgba(0,0,0,0.04) !important; }
    details summary svg { display: none !important; }
    details:not([open]) summary::before {
        content: "";
        display: inline-block;
        width: 18px; height: 18px;
        margin-right: 8px;
        vertical-align: middle;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E");
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        opacity: 0.75;
    }
    details[open] summary::before {
        content: "⚜";
        margin-right: 8px;
        font-size: 0.95rem;
        vertical-align: middle;
    }
    </style>
    """, unsafe_allow_html=True)

    # ─── ヘッダーバナー ───
    st.markdown(
        f'<div class="banner-wrap"><img src="{BANNER_URL}" /></div>',
        unsafe_allow_html=True,
    )

    # ─── snake_kisaki.png を base64 エンコード ───

    # ─── タブナビゲーション ───
    st.markdown("""
    <style>
    /* タブリストを中央寄せ */
    [data-testid="stTabs"] [role="tablist"] {
        justify-content: center;
    }
    /* タブボタンのフォントサイズ */
    [data-testid="stTabs"] [role="tab"] p {
        font-size: 1.3rem !important;
        font-weight: bold !important;
    }
    /* タブボタン先頭にsnake画像 */
    [data-testid="stTabs"] [role="tab"]::before {
        content: "";
        display: inline-block;
        width: 1.2em;
        height: 1.2em;
        margin-right: 6px;
        vertical-align: middle;
        background-image: url("data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAGeAZgDASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAEIBwkCBQYEA//EAFkQAAEDAwIEAwMHBwgFCAcJAAEAAgMEBQYHEQgSITFBUWETInEUMkJSgZGhFWJygpKxwQkWIzNDorLCJGNz0dIYJUZTg7PD0xcmNFVWk6M4R1RldHWUtPD/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AuUiIgIiICIiAiIgIiICIiAiIgIiICIiAiL86meGmp5KipmjhhjaXSSSODWtaO5JPQBB+iKveqHFXg+NmahxeKTJ7izdvPC72dI13rKR736gPxVcc24k9VsldIyK+MsVK49IbVEIiB/tDu/8AEINhlVU01LGZamoigYO7pHhoH2leZuupWn1qdI24Zrj9O+P57HV8fMPsB3WsS7Xa63eZ892ulfcJXndz6qpfKSf1iV8Ia1vZrR8Ag2Vv150fYdjqBZfskcf3BcTr5o6P/vAs/wC27/hWtnmd5lOd3mfvQbJhr5o6TsNQLP8AtO/4V29HqxplWcvyfPMdeX9ga+Np+4lawuY+Z+9cXAO7tafiEG2mguVur2c9BX0tUz60MzXj8CvrWpKgq6uglE1BVVFJIDuH08rozv8AFpCyTh+veq+MvZ8ly2rr4G94LkBUsI8t3e8PscEGyRFVfTbi9tdZJHR57Y3Wx7nbfLrfvLAPVzD77fs5lZjH71aMhtUN1sdypbjQzDeOenlD2O+0ePp3CDsEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREHU5dkVoxTHay/32tjo7fRxmSWR5+5oHi4noAOpJWvTXDW7LNT6ySnqJnW3H2vJgtcDyGkeBmP9o74+6PAeK9Bxh6oVGb6gTY7b6kHH7FM6GJrHe7PUDpJKfPY7tb5AE+KwYgKEJRBIRAiAiIgIiICndQhU0TuvY6X6k5bpzdzcMYuboGSOBqaSQc9PUAeD2ef5w2cPArxu6bqjZrolqnYNUcYFytjxT3CANbX0D3byUzz/AImHrs7x9CCF79attJ87uunWcUOT2pznewdyVMG+zamAn34z8R1HkQCtnWPXahv1iob1bJxPRV1OyogkH0mOAI/eg+9ERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBF8N7u9qsduluV5uNLb6OIbvnqZRGxv2lYB1I4s8JsgkpcRo6jJawbgTDeClaf03Dmd+qNvVBYtecy/O8NxGIyZLk1rthA3Ec9Q0SH4MHvH7AqE55xDap5a6SN+QOs1G4namtQ9gAPIydXn71iuaWWeofUTyvlmed3ySOLnuPmSepQbU8Iye05li9Hklilllt1YHGB8kRjLg1xbvynqBuCuh18ymTDdIMkyCnkEdVBRujpXb9RNJsxhHqHOB+xfNw3U0VJoRhkUJ3abTDIfi4cx/EleD476meHQ32MXzKi60zJT+aC5372hB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");
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
    }
    </style>
    """, unsafe_allow_html=True)
    tab1, tab2, tab3 = st.tabs(["LiveStreaming Info", "Uta-Mita DB", "Data Management"])

    df = get_data()

    with tab1:
        page_streams(df)
    with tab2:
        page_songs(df)
    with tab3:
        page_data_management(df)

    # ─── デバッグ：管理者のみ ───
    if st.session_state.get("authenticated") or "admin_password" not in st.secrets:
        with st.expander("🔍 接続診断", expanded=False):
            if st.button("診断実行", key="debug_btn"):
                debug_github()

if __name__ == "__main__":
    main()
