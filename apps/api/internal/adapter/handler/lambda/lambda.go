package lambda

import (
	"context"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"
)

type GinLambdaAdapter struct {
	adapter *ginadapter.GinLambda
}

func NewHttpLambdaAdapter(router *gin.Engine) *GinLambdaAdapter {
	adapter := ginadapter.New(router)
	return &GinLambdaAdapter{adapter: adapter}
}

func (a *GinLambdaAdapter) LambdaHandler(
	ctx context.Context,
	request events.APIGatewayProxyRequest,
) (events.APIGatewayProxyResponse, error) {
	resp, err := a.adapter.ProxyWithContext(ctx, request)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

func (a *GinLambdaAdapter) Serve() {
	lambda.Start(a.LambdaHandler)
}
