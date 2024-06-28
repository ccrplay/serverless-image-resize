FROM amazonlinux:2

RUN curl -sL https://rpm.nodesource.com/setup_16.x | bash - \
    && yum install -y nodejs \
    && yum clean all

WORKDIR /var/task

COPY . .

# Command to run the tests
CMD ["npm", "run", "test"]
