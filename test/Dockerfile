FROM amazonlinux:latest

RUN curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - \
    && yum install -y nodejs \
    && yum clean all

WORKDIR /var/task

COPY . .

# Command to run the tests
CMD ["npm", "run", "test"]
