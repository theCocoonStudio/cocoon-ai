# Sandbox for running Claude Code against this repo.
# Based on anthropics/claude-code/.devcontainer, trimmed to what we need.
FROM node:22

ARG TZ=America/New_York
ENV TZ="$TZ"
ARG CLAUDE_CODE_VERSION=latest
# Pinned: 0.62.0 audited 2026-10-02 (npm audit clean, Apache-2.0, one bundle, no runtime deps).
ARG GEMINI_CLI_VERSION=0.62.0

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl git gh jq less nano procps sudo \
  iptables ipset iproute2 dnsutils aggregate \
  chromium \
  && apt-get clean && rm -rf /var/lib/apt/lists/*
# chromium: the headless browser `npm run export:logo-group` screenshots its
# WebGL render with (SwiftShader, no GPU), driven by puppeteer-core from npm.
# Nothing else in the sandbox uses it.

# Global npm installs go somewhere the non-root user owns.
RUN mkdir -p /usr/local/share/npm-global && chown -R node:node /usr/local/share
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

RUN mkdir -p /workspace /home/node/.claude /home/node/.gemini /home/node/cocoon-ai-records \
  && chown -R node:node /workspace /home/node/.claude /home/node/.gemini /home/node/cocoon-ai-records
WORKDIR /workspace

ENV DEVCONTAINER=true
ENV EDITOR=nano VISUAL=nano

# Firewall script may be run via sudo by `node`, and nothing else.
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# Gemini CLI system settings, read before the user's own: usage statistics off (its
# telemetry host is not in the firewall anyway), auto-update off, API-key auth, no
# folder-trust prompt (the sandbox has one folder). Root-owned, so the agent cannot edit it.
COPY gemini-settings.json /etc/gemini-cli/settings.json
RUN chmod 0755 /usr/local/bin/init-firewall.sh /usr/local/bin/entrypoint.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
  && chmod 0440 /etc/sudoers.d/node-firewall

USER node
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
  @google/gemini-cli@${GEMINI_CLI_VERSION}

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
