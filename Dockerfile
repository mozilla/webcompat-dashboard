FROM node:lts

RUN \
    groupadd --gid 10001 app && \
    useradd --uid 10001 --gid 10001 --home /app --create-home app

USER app:app

WORKDIR /app

COPY . .

# These variables need to be set at build-time as they're embedded into
# The frontend build.
ARG VITE_BACKEND_WEB_ROOT
ARG VITE_FRONTEND_WEB_ROOT
ENV VITE_BACKEND_WEB_ROOT=${VITE_BACKEND_WEB_ROOT}
ENV VITE_FRONTEND_WEB_ROOT=${VITE_FRONTEND_WEB_ROOT}

RUN npm install && \
 npm run build

EXPOSE 3000

CMD ["npm", "start"]
