package sqs

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sqs"
	"github.com/pkg/errors"
)

type Client struct {
	region   string
	queueURL string
}

func NewSQSClient(region string, queueURL string) *Client {
	return &Client{
		region:   region,
		queueURL: queueURL,
	}
}

// SendMessage sends a message to an AWS SQS queue
// Returns the MessageID from SQS and any error encountered
func (c *Client) SendMessage(message any, highPriority bool) (*string, error) {
	body, err := json.Marshal(message)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal message body")
	}

	awsConfig := &aws.Config{
		Region: aws.String(c.region),
	}

	sess, err := session.NewSession(awsConfig)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create aws session")
	}

	sqsClient := sqs.New(sess)

	input := &sqs.SendMessageInput{
		QueueUrl:    aws.String(c.queueURL),
		MessageBody: aws.String(string(body)),
	}

	// Configure message priority and attributes
	c.setPriority(input, highPriority)

	result, err := sqsClient.SendMessage(input)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send message to SQS")
	}

	return result.MessageId, nil
}

// setPriority sets the DelaySeconds and MessageAttributes based on the priority level
func (c *Client) setPriority(input *sqs.SendMessageInput, highPriority bool) {
	// Add message attributes for priority handling
	if highPriority {
		// Set DelaySeconds to 0 for immediate processing (if the queue supports it)
		input.DelaySeconds = aws.Int64(0)

		// Add message attributes to mark as high priority
		input.MessageAttributes = map[string]*sqs.MessageAttributeValue{
			"Priority": {
				DataType:    aws.String("String"),
				StringValue: aws.String("HIGH"),
			},
			"Timestamp": {
				DataType:    aws.String("Number"),
				StringValue: aws.String(strconv.FormatInt(time.Now().UnixMilli(), 10)),
			},
			"ProcessImmediately": {
				DataType:    aws.String("String"),
				StringValue: aws.String("true"),
			},
		}
	} else {
		// Standard priority messaging
		input.MessageAttributes = map[string]*sqs.MessageAttributeValue{
			"Priority": {
				DataType:    aws.String("String"),
				StringValue: aws.String("NORMAL"),
			},
			"Timestamp": {
				DataType:    aws.String("Number"),
				StringValue: aws.String(strconv.FormatInt(time.Now().UnixMilli(), 10)),
			},
		}
	}
}
