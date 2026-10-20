# Cash Flow

## Table of Contents
- [Running Locally](#running-locally)
  - [Running Inside Containers](#running-inside-containers)
- [Create Mocks](#create-mocks)
- [Redis Invalidation Policies for Golang](#redis-invalidation-policies-for-golang)
  - [Redis Invalidation Policies File](#redis-invalidation-policies-file)
  - [Validate Policies](#validate-policies)
- [Creating Migration Files in Go](#creating-migration-files-in-go)
- [CDK Lambda deployment](#cdk-lambda-deployment)
- [Create Pg Cron](#create-pg-cron)
- [Update Pg Cron](#update-pg-cron)
- [Swagger Documentation](#swagger-documentation)
- [Important Git Commands](#important-git-commands)
- [Troubleshooting](#troubleshooting)
  - [Database Connection Limit Error](#database-connection-limit-error)

# Running Locally

To run the application locally, follow these steps:

1. **Set the `.env` file**:
   Ensure you have as `.env` file in the root directory of your project with the following content:

   ```dotenv
   APP_NAME="cash-flow"
   APP_ENV="development"

   HTTP_URL="127.0.0.1"
   HTTP_PORT="8080"
   HTTP_ALLOWED_ORIGINS="http://127.0.0.1:3000,http://127.0.0.1:5173"

   DB_CONNECTION="postgres"
   DB_HOST="127.0.0.1"
   DB_PORT="5432"
   DB_NAME="cashflow"
   DB_USER="postgres"
   DB_PASSWORD="postgres"
   DB_MAX_OPEN_CONNS="25"
   DB_MAX_IDLE_CONNS="5"
   DB_CONN_MAX_LIFETIME="5m"

   REDIS_ADDR="localhost:6379"
   REDIS_PASSWORD="redis"

   TOKEN_DURATION="15m"
     ```

2. **Run DockerCompose**:
   Use Docker Compose to set up the necessary services (e.g., database, cache, api):

   ```sh
   docker compose -f docker-compose-local.yml build
    ```

   ```sh
   docker compose -f docker-compose-local.yml up
    ```

3. **Run the Application**:
   Start the application using the Go command:

   ```sh
   go run main.go
   ```

4. **Run the Application with Compose**:

   If you run the application with compose, don't forget to change the `DB_HOST` and `REDIS_ADDR` in the `.env` file to
   `postgres` and `redis:6379` respectively.:

   ```
   DB_HOST="postgres"
   REDIS_ADDR="redis:6379"
   ```

### Running Inside Containers
To run the application inside containers, execute the next command:

```sh
  docker exec -it <container_name_or_id> /bin/sh
```

# Create Mocks
To create mocks for the application, run the following command:

```sh
  go generate ./internal/common/port/cache.go
```

# Redis  Invalidation Policies for Golang

1. Time-based (TTL): Cache entries expire after as set time-to-live (TTL).
2. Manual Invalidation: Explicitly clearing cache entries when data changes.
3. Event-based: Cache updates based on specific triggers/events, such as database updates.
4. Least Recently Used (LRU): Evicts the least recently accessed items when the cache reaches capacity.
5. Least Frequently Used (LFU): Removes the least frequently accessed items to make room for new entries. Each policy
   ensures cached data remains fresh, balancing performance and consistency.

## Redis Invalidation Policies File

You can set other policies locally by changing the `redis.conf` file. The following are some of the available policies:

- allkeys-lru: Evicts any key using the LRU algorithm.
- volatile-lru: Evicts only keys with expiration.
- volatile-ttl: Evicts keys with an expiration set, prioritizing those with the shortest time to live.
- allkeys-random: Randomly evicts keys when memory Limit is reached.

## Validate Policies

To validate the policies, you can use the `redis-cli` command-line tool. 
```sh
   redis-cli info memory
```

```sh
  redis-cli info stats
```

## Creating Migration Files in Go
To create migration files in Go, you can use a migration tool like golang-migrate. Here are the steps to create and manage migration files:  


1. **Install golang-migrate**:
   ```sh
   go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
   ```

2. **Create a New Migration**:
   Use the migrate command to create a new migration file. Replace migration_name with a descriptive name for your migration.  

   ```sh
     migrate create -ext sql -dir internal/adapter/storage/postgres/migrations -seq migration_name
   ```

   This will create two files in the `internal/adapter/storage/postgres/migrations` directory:

   - `xxxxxx_migration_name.up.sql`
   - `xxxxxx_migration_name.down.sql`

3. **Dirty Migrations**:
   In case migrations are dirty, add the next code in the migrations script
   ```go
    // Force the migration to as specific version if the database is dirty
    err := migrations.Force(4)
    if err != nil {
        panic("Error forcing migration version")
    }
   ```

## CDK Lambda deployment
For lambda deployment follow the next steps
```sh
  GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o cmd/lambda/bootstrap cmd/lambda/main.go
```

```sh
  zip cmd/lambda/cashflow.zip -j cmd/lambda/bootstrap
```

## Create Pg Cron
To create a pg cron job,first you need to create the extension in your database, running the following command:

```sql
CREATE EXTENSION pg_cron;
```
Then, you can create a cron job to refresh the materialized view `last_month_balance` every day at 5 AM UTC-0 (12:00 AM UTC-5) using the following command:

```sql
SELECT cron.schedule('last_month_balance', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY LAST_MONTH_BALANCE');
```

Also, you can create a cron job to refresh the materialized view `historic_cumulative_balance` every day at 5 AM UTC-0 (12:00 AM UTC-5) using the following command:

```sql
SELECT cron.schedule('historic_cumulative_balance', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY HISTORIC_CUMULATIVE_BALANCE');
```



## Update Pg Cron

To update the pg cron, you can use the following command:

Update the schedule of the cron job with jobi d 1 to run every day at 5 AM UTC-0 (12:00 AM UTC-5)

```sql
SELECT cron.alter_job(1, schedule => '*/5 * * * *');
```

Update the command of the cron job with jobi d 1.

```sql
SELECT cron.alter_job(1, command => 'REFRESH MATERIALIZED VIEW CONCURRENTLY BALANCE');
```

To list all cron jobs

```sql
SELECT * FROM cron.job;
```

To list the run details

```sql
SELECT jobid, username, status, return_message, start_time FROM cron.job_run_details;
```

To stop/delete a job

```sql
SELECT cron.unschedule(job_id);
```

Delete a cron
```sql
SELECT cron.unschedule('last_month_balance');
```

```sql
SELECT cron.unschedule('historic_cumulative_balance');
```

## Swagger Documentation
To generate Swagger documentation for your Go application, you can use the `swag` tool. Follow these steps:

1. **Install swag**:
If you haven't installed `swag` yet, you can do so by running the following command:

   ```sh
   go get -u github.com/swaggo/files
   ```
   
      ```sh
   go get -u github.com/swaggo/gin-swagger
   ```

2. **Generate Swagger Documentation**:
Navigate to the root directory of your Go application and run the following command:

   ```sh
   swag init -g cmd/http/main.go
   ```

   This will generate the Swagger documentation files in the `docs` directory.

## Important Git Commands

1. **Squash Commits**:
    To squash the last N commits into a single commit, use the following command:
    ```sh
    git rebase -i HEAD~N
    ```
    Replace `N` with the number of commits you want to squash. In the interactive editor that opens, 
    change `pick` to `squash` (or `s`) for the commits you want to combine. We can pick the first one
    and squash the remaining. Save and close the editor, then provide a new commit message when prompted.
    Check the next link for more details: [Git Squash](https://www.datacamp.com/tutorial/git-squash-commits).

## Troubleshooting

### Database Connection Limit Error

**Error Message:**
```
ERROR error pinging database error="failed to connect to `user=postgres database=cashflowprod`: 
server error: FATAL: remaining connection slots are reserved for roles with privileges of the 
\"rds_reserved\" role (SQLSTATE 53300)"
```

**Root Cause:**
The PostgreSQL database has reached its maximum connection limit. All available connection slots are exhausted, and only connections with `rds_reserved` role privileges are allowed.

**Solutions:**

1. **Immediate Fix - Terminate Idle Connections:**
   Connect to the database and run the following SQL commands:
   ```sql
   -- View current connections
   SELECT pid, usename, application_name, state, query_start 
   FROM pg_stat_activity 
   WHERE datname = 'cashflowprod';

   -- Terminate idle connections (use with caution in production)
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE datname = 'cashflowprod' 
   AND state = 'idle' 
   AND query_start < NOW() - INTERVAL '5 minutes';
   ```

2. **Configure Connection Pooling:**
   Add the following environment variables to your `.env` file to limit connection usage (already implemented in code):
   ```dotenv
   DB_MAX_OPEN_CONNS=25
   DB_MAX_IDLE_CONNS=5
   DB_CONN_MAX_LIFETIME=5m
   ```
   
   The application will automatically use these values if provided. If not provided, it will use the default values (25, 5, and 5m respectively).

3. **Increase RDS Max Connections:**
   Modify the RDS parameter group to increase `max_connections`. Note that this requires an instance reboot or parameter group change.

4. **Use Local Database for Development:**
   Ensure your local environment is not connecting to the production database. Verify your `.env` file points to the local database:
   ```dotenv
   DB_HOST="127.0.0.1"
   DB_NAME="cashflow"
   DB_USER="postgres"
   DB_PASSWORD="postgres"
   ```

**Prevention:**
- Always use connection pooling with appropriate limits
- Monitor active connections regularly
- Ensure application properly closes database connections
- Use separate databases for development, staging, and production environments


Commands you can use next
=========================
```
[*] Create pipeline: cd cashflow && sam pipeline init --bootstrap
[*] Validate SAM template: cd cashflow && sam validate
[*] Test Function in the Cloud: cd cashflow && sam sync --stack-name {stack-name} --watch
```

## Resources

- [Redis Invalidation Policies](https://dev.to/truongpx396/golang-restful-api-with-gin-gorm-redis-cache-2gia)
- [LRU Cache in Golang](https://github.com/sysulq/golang-cache/blob/lru/example/main.go)
- [CashFlow architecture](https://app.eraser.io/workspace/sfJOCLmQKDqePFLZgbe5?origin=share)
- [SAM deployment](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-getting-started-hello-world.html)


DB_CONNECTION=postgres
DB_HOST="127.0.0.1"
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=cashflow
DB_SSL_MODE=disable