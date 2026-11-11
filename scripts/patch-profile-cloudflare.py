"""Compatibility entrypoint. The guarded integration is maintained in JavaScript."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
subprocess.run(["node", str(root / "scripts" / "integrate-profile.mjs")], cwd=root, check=True)
