FROM node:alpine
MAINTAINER Carlos Ravelo <ravelo.carlos@gmail.com>

# Create our application direcory
RUN mkdir -p /app
WORKDIR /app

# Copy and install dependencies
COPY package.json /app/
RUN npm install --production

# Copy everything else
COPY ./src /app

# Expose Configuration Volume
VOLUME /config

# Set config directory
ENV ENV_CONFIG=/config/.env

# Expose the web service port
#EXPOSE 8080

# Run the service
CMD [ "npm", "start" ]
