# Sandbox for running Claude Code against this repo.
# Based on anthropics/claude-code/.devcontainer, trimmed to what we need.
FROM node:22

ARG TZ=America/New_York
ENV TZ="$TZ"
# Pinned; bump on purpose, with the changelog read. 2.1.287 was the image's version on 2026-10-02; 2.1.288 on 2026-10-03, changelog read.
ARG CLAUDE_CODE_VERSION=2.1.288

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

RUN mkdir -p /workspace /home/node/.claude /home/node/cocoon-ai-records \
  && chown -R node:node /workspace /home/node/.claude /home/node/cocoon-ai-records
WORKDIR /workspace

ENV DEVCONTAINER=true
ENV EDITOR=nano VISUAL=nano

# Firewall script may be run via sudo by `node`, and nothing else.
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/init-firewall.sh /usr/local/bin/entrypoint.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
  && chmod 0440 /etc/sudoers.d/node-firewall

USER node
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}
# After the global installs: the agent's npm never runs a package's install scripts.
# The repo's lockfile needs none (checked 2026-10-02); a dependency that does is a
# deliberate, reviewed exception, not a default.
RUN npm config set ignore-scripts true

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
