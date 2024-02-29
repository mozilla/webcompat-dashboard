FROM node:lts

RUN \
    groupadd --gid 10001 app && \
    useradd --uid 10001 --gid 10001 --home /app --create-home app

USER app:app

WORKDIR /app

COPY . .

RUN npm install && \
 npm run build

EXPOSE 3000

CMD ["npm", "start"]
