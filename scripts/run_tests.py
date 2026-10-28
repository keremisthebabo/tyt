import glob
import os
import subprocess
import sys

NODE_EXE = r"C:\Users\kanbak\AppData\Local\Programs\antigravity\Antigravity.exe"

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    test_files = sys.argv[1:]
    if not test_files:
        test_files = sorted(glob.glob("tests/*.test.mjs"))
    if not test_files:
        print("No test files found.")
        sys.exit(1)

    env = os.environ.copy()
    env["ELECTRON_RUN_AS_NODE"] = "1"
    cmd = [NODE_EXE, "--test"] + test_files
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, file=sys.stderr, end="")
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
