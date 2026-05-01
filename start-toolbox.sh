#!/bin/bash
set -a
source agent/.env
set +a
/home/akash/.local/bin/mcp-toolbox --tools-file tools_real.yaml
