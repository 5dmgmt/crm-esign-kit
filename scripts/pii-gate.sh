#!/usr/bin/env bash
set -euo pipefail

denylist=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --denylist)
      [[ $# -ge 2 ]] || { printf '%s\n' "--denylist にはファイルを指定してください。" >&2; exit 2; }
      denylist="$2"
      shift 2
      ;;
    *)
      printf '%s\n' "未対応の引数です: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -n "$denylist" && ! -f "$denylist" ]]; then
  printf '%s\n' "否定リストを読み込めませんでした。" >&2
  exit 2
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
content_file="$tmp_dir/content.txt"
history_patch="$tmp_dir/history-patch.txt"
history_meta="$tmp_dir/history-meta.txt"
: > "$content_file"
: > "$history_patch"
: > "$history_meta"

while IFS= read -r -d '' file; do
  if [[ -f "$file" ]] && grep -Iq . "$file"; then
    sed 's/\r$//' "$file" >> "$content_file"
    printf '\n' >> "$content_file"
  fi
done < <(git ls-files -z --cached --others --exclude-standard)

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  git log --all -p > "$history_patch"
  git log --all --format='%an %ae%n%B' > "$history_meta"
fi

sources=("$content_file" "$history_patch" "$history_meta")
count_pattern() {
  local pattern="$1"
  local total=0
  local count=0
  for source in "${sources[@]}"; do
    count="$(grep -Eo "$pattern" "$source" 2>/dev/null | wc -l | tr -d ' ' || true)"
    total=$((total + count))
  done
  printf '%s' "$total"
}

email_count=0
for source in "${sources[@]}"; do
  count="$(grep -Eo '[A-Za-z0-9.!#$%&'"'"'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$source" 2>/dev/null \
    | grep -Eiv '@(example\.(com|org|jp)|users\.noreply\.github\.com)$' \
    | wc -l | tr -d ' ' || true)"
  email_count=$((email_count + count))
done

phone_count="$(count_pattern '(^|[^0-9])0[1-9][0-9]{0,3}[-ー−(][0-9]{1,4}[)ー−-][0-9]{3,4}([^0-9]|$)')"
postal_count="$(count_pattern '(^|[^0-9])[0-9]{3}-[0-9]{4}([^0-9]|$)')"
deny_count=0

if [[ -n "$denylist" ]]; then
  while IFS= read -r term || [[ -n "$term" ]]; do
    [[ -z "$term" || "$term" == \#* ]] && continue
    for source in "${sources[@]}"; do
      count="$(grep -Fo -- "$term" "$source" 2>/dev/null | wc -l | tr -d ' ' || true)"
      deny_count=$((deny_count + count))
    done
  done < "$denylist"
fi

total=$((email_count + phone_count + postal_count + deny_count))
printf 'PII gate: email=%d phone=%d postal=%d denylist=%d total=%d\n' \
  "$email_count" "$phone_count" "$postal_count" "$deny_count" "$total"
[[ "$total" -eq 0 ]]
