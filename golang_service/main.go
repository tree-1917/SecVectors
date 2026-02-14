package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
)

type Ticket struct {
	Subject           string `json:"subject"`
	Issue             string `json:"issue"`
	Namespace         string `json:"namespace"`
	CustomerSentiment string `json:"customer_sentiment"`
}

var ctx = context.Background()

func main() {
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "redis"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:6379", redisHost),
	})

	pgHost := os.Getenv("POSTGRES_HOST")
	if pgHost == "" {
		pgHost = "postgres"
	}
	pgConn := fmt.Sprintf("host=%s port=5432 user=user password=pass dbname=support_db sslmode=disable", pgHost)
	db, err := sql.Open("postgres", pgConn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Wait for DB
	for i := 0; i < 10; i++ {
		err = db.Ping()
		if err == nil {
			break
		}
		log.Println("Waiting for database...")
		time.Sleep(2 * time.Second)
	}

	log.Println("Golang service started, polling Redis...")

	for {
		// BRPOP is blocking pop from the right (tickets list)
		result, err := rdb.BRPop(ctx, 0, "tickets").Result()
		if err != nil {
			log.Println("Error popping from Redis:", err)
			continue
		}

		var ticket Ticket
		err = json.Unmarshal([]byte(result[1]), &ticket)
		if err != nil {
			log.Println("Error unmarshaling ticket:", err)
			continue
		}

		// Mock sentiment analysis
		ticket.CustomerSentiment = "Neutral"
		if len(ticket.Issue) > 50 {
			ticket.CustomerSentiment = "Frustrated"
		} else if len(ticket.Issue) < 10 {
			ticket.CustomerSentiment = "Curious"
		}

		// Insert into PostgreSQL
		_, err = db.Exec("INSERT INTO tickets (subject, issue, customer_sentiment, namespace) VALUES ($1, $2, $3, $4)",
			ticket.Subject, ticket.Issue, ticket.CustomerSentiment, ticket.Namespace)
		if err != nil {
			log.Println("Error inserting into Postgres:", err)
			continue
		}

		log.Printf("Processed ticket for namespace %s: %s (Sentiment: %s)\n", ticket.Namespace, ticket.Subject, ticket.CustomerSentiment)
	}
}
