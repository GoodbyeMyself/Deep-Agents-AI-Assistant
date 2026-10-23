FROM node:22-bookworm-slim
WORKDIR /opt/mcp
COPY out/product-a-mcp/ ./
COPY docker/normalize-deploy-links.cjs /opt/normalize-deploy-links.cjs
RUN node /opt/normalize-deploy-links.cjs /opt/mcp
ENV NODE_ENV=production PRODUCT_A_MCP_HTTP_HOST=0.0.0.0 PRODUCT_A_MCP_HTTP_PORT=3101
USER node
EXPOSE 3101
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 CMD node -e "fetch('http://127.0.0.1:3101/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/http.js"]
