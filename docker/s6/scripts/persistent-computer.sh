#!/bin/sh
# Optional persistent browser/files storage beside the embedded database's data directory.
set -eu
[ -n "${OPENBOT_COMPUTER_DATA_DIR:-}" ] || exit 0
case "$OPENBOT_COMPUTER_DATA_DIR" in
  /*) ;;
  *) echo "OPENBOT_COMPUTER_DATA_DIR must be absolute" >&2; exit 1 ;;
esac
for name in workspace profiles; do
  target="$OPENBOT_COMPUTER_DATA_DIR/$name"
  mkdir -p "$target"
  chown pwuser:pwuser "$target"
  if [ -L "/$name" ]; then
    [ "$(readlink "/$name")" = "$target" ] || exit 1
  else
    # The image ships empty directories. Refuse to replace one containing data.
    rmdir "/$name"
    ln -s "$target" "/$name"
  fi
done
