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
    mkdir -p /root/.config/opencode/skills && \
    mkdir -p /root/.config/opencode/prompts && \
    cp config/agents.json /root/.config/opencode/ && \
    cp config/mcp.json /root/.config/opencode/ && \
    cp config/lsp.json /root/.config/opencode/ && \
    cp config/fallback.json /root/.config/opencode/ && \
    cp config/AGENTS.md /root/.config/opencode/ && \
    cp config/skills/*.md /root/.config/opencode/skills/ && \
    cp config/profiles/*.json /root/.config/opencode/profiles/ && \
    cp config/prompts/*.txt /root/.config/opencode/prompts/

# Create non-root user
RUN useradd -m -s /bin/bash opencode && \
    cp -r /root/.config /home/opencode/.config && \
    chown -R opencode:opencode /home/opencode/.config

USER opencode
ENV XDG_CONFIG_HOME=/home/opencode/.config

ENTRYPOINT ["opencode-jce"]
CMD ["--help"]
