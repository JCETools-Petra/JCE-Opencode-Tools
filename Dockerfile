FROM oven/bun:1 AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Install globally
RUN bun install -g .

# Set config directory
ENV XDG_CONFIG_HOME=/root/.config
RUN mkdir -p /root/.config/opencode/profiles && \
    cp config/agents.json /root/.config/opencode/ && \
    cp config/mcp.json /root/.config/opencode/ && \
    cp config/lsp.json /root/.config/opencode/ && \
    cp config/profiles/*.json /root/.config/opencode/profiles/

ENTRYPOINT ["opencode-suite"]
CMD ["--help"]
