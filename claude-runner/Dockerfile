FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user (Claude Code won't run --dangerously-skip-permissions as root)
RUN useradd -m -s /bin/bash claude \
  && mkdir -p /home/claude/.config \
  && chown -R claude:claude /home/claude

# Configure git identity for commits (as the claude user)
USER claude
RUN git config --global user.name "HanLearn Bot" \
  && git config --global user.email "bot@hanlearn.dev"

# Working directory for scripts
WORKDIR /app
USER root

# Copy runner scripts
COPY entrypoint.sh process-issue.sh plan-issue.sh run-default-task.sh ./
RUN chmod +x entrypoint.sh process-issue.sh plan-issue.sh run-default-task.sh \
  && chown claude:claude entrypoint.sh process-issue.sh plan-issue.sh run-default-task.sh

# Create directories for mounted volumes (task config and state)
# These will be mounted from the host via docker-compose
RUN mkdir -p ./claude-tasks/logs ./claude-scripts \
  && chown -R claude:claude ./claude-tasks ./claude-scripts

USER claude
ENTRYPOINT ["./entrypoint.sh"]
