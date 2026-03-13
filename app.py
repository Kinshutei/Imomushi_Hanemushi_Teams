import streamlit as st
import pandas as pd
import plotly.express as px
import io
import base64
import requests
import re

# ─────────────────────────────────────────
# 定数
# ─────────────────────────────────────────
CSV_COLUMNS = ["枠名", "楽曲名", "歌唱順", "配信日", "枠URL", "コラボ相手様", "原曲Artist", "作詞", "作曲", "リリース日"]

BANNER_URL = (
    "https://yt3.googleusercontent.com/6REyrT4s7DrjAvRL0yJUJJxi3Ahb59XtcnnDNpu7lC7sojUKthxvBIWJDVSyExFi1BOyJPzZWg"
    "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
)
ACCENT = "#6b9fd4"

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
    empty = pd.DataFrame(columns=CSV_COLUMNS)
    if not _gh_secrets_ok():
        try:
            df = pd.read_csv("streaming_info_mikage.csv", encoding="utf-8-sig")
            return _normalize_df(df)
        except FileNotFoundError:
            return empty
    repo   = st.secrets["github_repo"]
    path   = st.secrets["github_csv_path"]
    branch = _gh_branch()
    url    = f"https://api.github.com/repos/{repo}/contents/{path}?ref={branch}"
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
    if not _gh_secrets_ok():
        df.to_csv("streaming_info_mikage.csv", index=False, encoding="utf-8-sig")
        return True, "ローカルファイルに保存しました。"
    repo   = st.secrets["github_repo"]
    path   = st.secrets["github_csv_path"]
    branch = _gh_branch()
    url    = f"https://api.github.com/repos/{repo}/contents/{path}"
    try:
        res = requests.get(f"{url}?ref={branch}", headers=_gh_headers(), timeout=10)
        sha = res.json().get("sha") if res.status_code == 200 else None
        csv_bytes = df.to_csv(index=False).encode("utf-8-sig")
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
    for col in CSV_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[CSV_COLUMNS].copy()
    df["歌唱順"] = pd.to_numeric(df["歌唱順"], errors="coerce").fillna(0).astype(int)
    df["配信日"] = df["配信日"].apply(_parse_date)
    df["コラボ相手様"] = df["コラボ相手様"].fillna("なし").astype(str)
    for col in ["枠URL", "原曲Artist", "作詞", "作曲"]:
        df[col] = df[col].fillna("").astype(str)
    df["リリース日"] = df["リリース日"].apply(
        lambda v: "" if pd.isna(v) or str(v).strip() in ("", "nan", "NaN") else str(v).strip()
    )
    return df

def _parse_date(val) -> str:
    s = str(val).strip()
    m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", s)
    if m:
        s = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    try:
        return pd.to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return s

# ─────────────────────────────────────────
# Excel → CSV 変換
# ─────────────────────────────────────────
def _format_release_date(val) -> str:
    if val is None:
        return ""
    try:
        if pd.isna(val):
            return ""
    except (TypeError, ValueError):
        pass
    if hasattr(val, "strftime"):
        try:
            return val.strftime("%Y-%m-%d")
        except Exception:
            return ""
    s = str(val).strip()
    if not s or s in ("nan", "NaN"):
        return ""
    try:
        return pd.to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return s

def convert_excel_to_df(raw: bytes) -> tuple:
    """
    Excelファイルを読み込み、深影のデータだけをCSV形式のDataFrameに変換する。
    - performancesシート：VTuber == '深影' のみ対象
    - songsシートと曲名でJOINして作詞・作曲・リリース日を補完
    - 枠URLはタイムスタンプ列からVideo IDを抽出してクリーンなURLを生成
    - 歌唱順は同一枠内の行順から自動採番
    """
    try:
        xls = pd.ExcelFile(io.BytesIO(raw))
    except Exception as e:
        return None, f"Excelファイルの読み込みに失敗しました: {e}"

    if "performances" not in xls.sheet_names:
        return None, "「performances」シートが見つかりません。"

    perf = xls.parse("performances")
    perf.columns = [str(c).strip() for c in perf.columns]

    required_cols = ["VTuber", "日付", "歌枠タイトル", "曲名", "アーティスト"]
    missing = [c for c in required_cols if c not in perf.columns]
    if missing:
        return None, f"performancesシートに必要な列がありません: {missing}"

    # 深影のみ抽出
    perf = perf[perf["VTuber"] == "深影"].copy()
    if perf.empty:
        return None, "深影のデータが見つかりませんでした。"

    # songsシートをJOIN
    song_map = {}
    if "songs" in xls.sheet_names:
        songs = xls.parse("songs")
        songs.columns = [str(c).strip() for c in songs.columns]
        for _, row in songs.iterrows():
            title = str(row.get("タイトル", "")).strip()
            if not title:
                continue
            song_map[title] = {
                "作詞": "" if pd.isna(row.get("作詞", "")) else str(row.get("作詞", "")).strip(),
                "作曲": "" if pd.isna(row.get("作曲", "")) else str(row.get("作曲", "")).strip(),
                "リリース日": _format_release_date(row.get("リリース日", "")),
            }

    # 枠ごとのVideo IDを収集
    ts_col = "タイムスタンプ" if "タイムスタンプ" in perf.columns else None
    frame_video_id = {}
    if ts_col:
        for _, row in perf.iterrows():
            ts = str(row.get(ts_col, ""))
            if not ts or ts == "nan":
                continue
            m = re.search(r"(?:v=|live/)([A-Za-z0-9_-]{11})", ts)
            if m:
                frame_key = str(row["歌枠タイトル"]).strip()
                frame_video_id[frame_key] = m.group(1)

    # 配信日の正規化
    perf["_date_str"] = perf["日付"].apply(
        lambda v: pd.to_datetime(v).strftime("%Y-%m-%d") if not pd.isna(v) else ""
    )
    perf["_frame_key"] = perf["歌枠タイトル"].astype(str).str.strip()

    rows = []
    for frame_key, group in perf.groupby("_frame_key", sort=False):
        group = group.reset_index(drop=True)
        date_str  = group.iloc[0]["_date_str"]
        video_id  = frame_video_id.get(frame_key, "")
        frame_url = f"https://www.youtube.com/live/{video_id}" if video_id else ""

        for idx, row in group.iterrows():
            song_title = str(row.get("曲名", "")).strip()
            artist     = "" if pd.isna(row.get("アーティスト", "")) else str(row.get("アーティスト", "")).strip()
            song_info  = song_map.get(song_title, {})

            rows.append({
                "枠名":       frame_key,
                "楽曲名":     song_title,
                "歌唱順":     idx + 1,
                "配信日":     date_str,
                "枠URL":      frame_url,
                "コラボ相手様": "なし",
                "原曲Artist": artist,
                "作詞":       song_info.get("作詞", ""),
                "作曲":       song_info.get("作曲", ""),
                "リリース日": song_info.get("リリース日", ""),
            })

    if not rows:
        return None, "変換後のデータが空になりました。"

    result_df = pd.DataFrame(rows, columns=CSV_COLUMNS)
    return result_df, ""

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
    if st.button("ログイン"):
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

    if "streams_expanded" not in st.session_state:
        st.session_state.streams_expanded = False

    c1, c2, _ = st.columns([1, 1, 8])
    with c1:
        if st.button("▼ 全て開く", use_container_width=True):
            st.session_state.streams_expanded = True
            st.rerun()
    with c2:
        if st.button("▲ 全て閉じる", use_container_width=True):
            st.session_state.streams_expanded = False
            st.rerun()

    streams = (
        df[["枠名", "配信日", "枠URL"]]
        .drop_duplicates(subset=["枠名", "配信日"])
        .sort_values("配信日", ascending=False)
        .reset_index(drop=True)
    )

    for _, row in streams.iterrows():
        label = f"**{row['配信日']}**　{row['枠名']}"
        with st.expander(label, expanded=st.session_state.streams_expanded):
            setlist = (
                df[df["枠名"] == row["枠名"]]
                [["歌唱順", "楽曲名", "コラボ相手様", "枠URL"]]
                .sort_values("歌唱順")
                .rename(columns={"枠URL": "楽曲URL"})
                .reset_index(drop=True)
            )

            thumb_url = None
            clean_url = str(row.get("枠URL", ""))
            yt_match = re.search(r"(?:v=|live/)([A-Za-z0-9_-]{11})", clean_url)
            if yt_match:
                vid = yt_match.group(1)
                thumb_url = f"https://img.youtube.com/vi/{vid}/mqdefault.jpg"
                clean_url = f"https://www.youtube.com/live/{vid}"

            col_thumb, col_table = st.columns([1, 2])
            with col_thumb:
                if thumb_url:
                    st.image(thumb_url, use_container_width=True)
                    st.markdown(f"[▶ YouTubeで開く]({clean_url})")
                else:
                    st.caption("サムネイルなし")
            with col_table:
                if setlist.empty:
                    st.info("この枠にはまだ曲が登録されていません。")
                else:
                    st.dataframe(
                        setlist,
                        use_container_width=True,
                        hide_index=True,
                        column_config={
                            "楽曲URL": st.column_config.LinkColumn("楽曲URL", display_text="▶ 開く")
                        },
                    )

# ─────────────────────────────────────────
# ページ：曲一覧 & 統計
# ─────────────────────────────────────────
def page_songs(df: pd.DataFrame):
    if df.empty:
        st.info("曲がまだ登録されていません。")
        return

    def to_release_year(val):
        v = str(val).strip()
        if not v or v in ("nan", "NaN", ""):
            return ""
        m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", v)
        if m:
            v = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        try:
            return f"{pd.to_datetime(v).year}年"
        except Exception:
            return ""

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
    count_df["リリース年"] = count_df["リリース日"].apply(to_release_year)
    cols = list(count_df.columns)
    if "リリース年" in cols and "リリース日" in cols:
        cols.remove("リリース年")
        cols.insert(cols.index("リリース日") + 1, "リリース年")
        count_df = count_df[cols]

    st.dataframe(count_df, use_container_width=True, hide_index=True)

    st.subheader("歌唱回数ランキング（上位20曲）")
    top20 = count_df[count_df["歌唱回数"] > 0].head(20).copy()
    if top20.empty:
        st.info("まだデータがありません。")
    else:
        max_count = top20["歌唱回数"].max()
        top20["_c"] = top20["歌唱回数"].apply(
            lambda v: f"rgba(107,159,212,{0.25 + 0.55 * v / max_count})"
        )
        fig = px.bar(
            top20, x="歌唱回数", y="楽曲名", orientation="h", text="歌唱回数",
            hover_data=["原曲アーティスト", "作詞", "作曲"],
        )
        fig.update_traces(
            marker_color=top20["_c"].tolist(),
            marker_line_width=0,
            textposition="outside",
            textfont=dict(size=11, color="#888888"),
        )
        fig.update_layout(
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#555555", size=12),
            yaxis=dict(autorange="reversed", showgrid=False, tickfont=dict(size=11, color="#666666")),
            xaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.06)", zeroline=False, tickfont=dict(size=10, color="#888888")),
            coloraxis_showscale=False,
            height=max(380, len(top20) * 26),
            margin=dict(l=10, r=55, t=16, b=10),
        )
        st.plotly_chart(fig, use_container_width=True)

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
            treemap_df, path=["リリース年"], values="曲数", color="曲数",
            color_continuous_scale=[[0.0,"#d0e4f4"],[0.4,"#9bbde0"],[0.7,"#6b9fd4"],[1.0,"#2e5a8a"]],
        )
        fig_tree.update_traces(
            texttemplate="<b>%{label}</b><br>%{value}曲",
            textfont=dict(size=13, color="#1a2e3a"),
            marker=dict(line=dict(width=2, color="#ffffff"), pad=dict(t=22, l=4, r=4, b=4)),
            hovertemplate="<b>%{label}</b><br>%{value}曲<extra></extra>",
        )
        fig_tree.update_layout(
            paper_bgcolor="rgba(0,0,0,0)", font=dict(color="#555555"),
            coloraxis_showscale=False, margin=dict(t=4, l=0, r=0, b=0), height=380,
        )
        st.plotly_chart(fig_tree, use_container_width=True)

    st.subheader("原曲アーティスト分布")
    artist_df = (
        count_df[count_df["原曲アーティスト"].str.len() > 0]
        .groupby("原曲アーティスト", as_index=False)
        .agg(歌唱回数=("歌唱回数", "sum"))
        .sort_values("歌唱回数", ascending=False)
    )
    if artist_df.empty:
        st.info("アーティストデータがまだありません。")
    else:
        fig_art = px.treemap(
            artist_df, path=["原曲アーティスト"], values="歌唱回数", color="歌唱回数",
            color_continuous_scale=[[0.0,"#d0e4f4"],[0.4,"#9bbde0"],[0.7,"#6b9fd4"],[1.0,"#2e5a8a"]],
        )
        fig_art.update_traces(
            texttemplate="<b>%{label}</b><br>%{value}曲",
            textfont=dict(size=13, color="#1a2e3a"),
            marker=dict(line=dict(width=2, color="#ffffff"), pad=dict(t=22, l=4, r=4, b=4)),
            hovertemplate="<b>%{label}</b><br>%{value}曲<extra></extra>",
        )
        fig_art.update_layout(
            paper_bgcolor="rgba(0,0,0,0)", font=dict(color="#555555"),
            coloraxis_showscale=False, margin=dict(t=4, l=0, r=0, b=0), height=420,
        )
        st.plotly_chart(fig_art, use_container_width=True)

# ─────────────────────────────────────────
# ページ：データ管理（認証必須）
# ─────────────────────────────────────────
def page_data_management(df: pd.DataFrame):
    if not check_password():
        return

    logout_button()

    # ── Excelインポート ──
    st.subheader("📊 Excelから一括インポート（深影データ自動変換）")
    st.info(
        "performancesシートの深影データを自動変換します。"
        "songsシートと曲名でJOINして作詞・作曲・リリース日を補完します。"
        "枠URLはタイムスタンプ列のVideo IDから自動生成します（なければ空欄）。",
        icon="ℹ️",
    )
    st.warning("⚠️ 実行すると既存データは全て置き換えられます。", icon="⚠️")

    uploaded_xlsx = st.file_uploader("Excelファイルを選択（.xlsx）", type=["xlsx"], key="import_xlsx")

    if uploaded_xlsx:
        raw = uploaded_xlsx.read()
        preview_df, err = convert_excel_to_df(raw)

        if err:
            st.error(err)
        elif preview_df is not None:
            st.success(f"変換成功：{len(preview_df)} 件（{preview_df['枠名'].nunique()} 枠）")
            with st.expander("変換結果プレビュー（先頭30行）", expanded=False):
                st.dataframe(preview_df.head(30), use_container_width=True, hide_index=True)

            if st.button("🚀 このデータでGitHubにコミット", type="primary", use_container_width=True):
                ok, msg = push_df(preview_df, commit_msg="Update: Excel import (深影)")
                if ok:
                    st.success(f"{len(preview_df)} 件をGitHubにコミットしました。")
                    st.cache_data.clear()
                    st.rerun()
                else:
                    st.error(msg)

    st.divider()

    # ── CSVエクスポート / インポート ──
    col_ex, col_im = st.columns(2)

    with col_ex:
        st.subheader("📤 CSVエクスポート")
        csv_bytes = df.to_csv(index=False).encode("utf-8-sig")
        st.download_button(
            label="⬇️ CSVダウンロード",
            data=csv_bytes,
            file_name="streaming_info_mikage.csv",
            mime="text/csv",
            use_container_width=True,
        )

    with col_im:
        st.subheader("📥 CSVインポート（完全上書き）")
        st.warning("⚠️ インポートすると既存データは全て置き換えられます。", icon="⚠️")
        uploaded_csv = st.file_uploader("CSVファイルを選択（UTF-8 / Shift-JIS）", type=["csv"], key="import_csv")
        if uploaded_csv:
            if st.button("🔁 CSVインポート実行", use_container_width=True, type="primary"):
                raw_csv = uploaded_csv.read()
                new_df = None
                for enc in ("utf-8-sig", "cp932", "utf-8"):
                    try:
                        new_df = pd.read_csv(io.BytesIO(raw_csv), encoding=enc)
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
                            st.success(f"{len(new_df)} 件をGitHubにコミットしました。")
                            st.cache_data.clear()
                            st.rerun()
                        else:
                            st.error(msg)

    st.divider()
    st.subheader("📋 現在のデータ")
    if df.empty:
        st.info("データがまだありません。")
    else:
        st.dataframe(df, use_container_width=True, hide_index=True)

# ─────────────────────────────────────────
# データ読み込み（キャッシュ付き）
# ─────────────────────────────────────────
@st.cache_data(ttl=60)
def get_data() -> pd.DataFrame:
    return load_df()

# ─────────────────────────────────────────
# メイン
# ─────────────────────────────────────────
def main():
    st.set_page_config(
        page_title="深影 歌ってみたDB",
        page_icon="🎵",
        layout="wide",
    )

    st.markdown(f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap');
    html, body, [class*="css"] {{ font-family: 'Noto Sans JP', sans-serif !important; font-size: 14px !important; }}
    h1 {{ font-size: 1.5rem !important; }}
    h2 {{ font-size: 1.2rem !important; }}
    h3 {{ font-size: 1.05rem !important; }}
    .stDataFrame, .stDataFrame td, .stDataFrame th {{ font-size: 13px !important; }}
    .streamlit-expanderHeader {{ font-size: 13px !important; }}
    details summary p {{ font-size: 13px !important; }}
    .stButton button, .stDownloadButton button {{ font-size: 13px !important; padding: 4px 12px !important; }}
    .stAlert p {{ font-size: 13px !important; }}
    p {{ line-height: 1.5 !important; }}
    .banner-wrap {{ margin: -4rem -4rem 0 -4rem; line-height: 0; }}
    .banner-wrap img {{ width: 100%; display: block; max-height: 220px; object-fit: cover; }}
    [data-testid="stTabs"] button p {{ font-size: 1.1rem !important; font-weight: bold !important; }}
    [data-testid="stTabs"] [role="tab"][aria-selected="true"] {{ border-bottom: 2px solid {ACCENT}; color: {ACCENT}; }}
    details summary:hover {{ background-color: rgba(107,159,212,0.08) !important; }}
    details summary svg {{ display: none !important; }}
    details:not([open]) summary::before {{
        content: "▶";
        margin-right: 8px;
        font-size: 0.8rem;
        vertical-align: middle;
        color: #888;
    }}
    details[open] summary::before {{
        content: "⚜";
        margin-right: 8px;
        font-size: 0.95rem;
        vertical-align: middle;
        color: {ACCENT};
    }}
    </style>
    """, unsafe_allow_html=True)

    st.markdown(
        f'<div class="banner-wrap"><img src="{BANNER_URL}" /></div>',
        unsafe_allow_html=True,
    )

    df = get_data()
    page_data_management(df)


if __name__ == "__main__":
    main()
