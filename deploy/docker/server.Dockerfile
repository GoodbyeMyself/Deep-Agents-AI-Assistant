FROM node:22-bookworm-slim

WORKDIR /opt/assistant/server

COPY out/server/ ./

ENV NODE_ENV=production \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3000

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/openapi.json').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server-main.js"]
