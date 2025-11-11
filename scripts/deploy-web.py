#!/usr/bin/env python3
# /// script
# requires-python = ">=3.13"
# dependencies = [
#    "boto3~=1.40",
# ]
# ///

import os
import boto3

EC2_INSTANCE_ID = os.getenv("EC2_INSTANCE_ID")
STEP_SUMMARY = os.getenv("GITHUB_STEP_SUMMARY")
AWS_REGION = os.getenv("AWS_REGION")
ECR_REGISTRY_HOST = os.getenv("ECR_REGISTRY_HOST")
ECR_IMAGE_NAME = os.getenv("ECR_IMAGE_NAME")
ECR_MANIFEST_DIGEST = os.getenv("ECR_MANIFEST_DIGEST")
APP_DIR = os.getenv("APP_DIR", "/app")
DEPLOY_DIRNAME = os.getenv("DEPLOY_DIRNAME", "angple")
CONTAINER_NAME = os.getenv("CONTAINER_NAME", "angple-web")
CONTAINER_PORT = os.getenv("CONTAINER_PORT", "3000")

scripts_template = """
#!/bin/bash
set -e

echo "## Start deployment script for Angple Web."

# ECR 로그인
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY_HOST}

echo "### docker pull..."
docker pull ${ECR_IMAGE_NAME}

echo "### Stopping and removing existing container..."
docker stop ${CONTAINER_NAME} || true
docker rm ${CONTAINER_NAME} || true

echo "### Starting new container..."
docker run -d \
  --name ${CONTAINER_NAME} \
  -p ${CONTAINER_PORT}:3000 \
  --restart unless-stopped \
  ${ECR_IMAGE_NAME}

echo "### Show running containers..."
docker ps --filter "name=${CONTAINER_NAME}"

echo "### Show container logs (last 20 lines)..."
docker logs --tail 20 ${CONTAINER_NAME}

echo "Latest image digest: ${ECR_MANIFEST_DIGEST}"

echo "### docker logout..."
docker logout ${ECR_REGISTRY_HOST}

echo "## Deployment script completed."
"""

def main() -> None:
    client = boto3.client("ssm")

    scripts = os.path.expandvars(scripts_template)

    response = client.send_command(
        InstanceIds=[EC2_INSTANCE_ID],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": [scripts]}
    )

    with open(STEP_SUMMARY, "a") as summary_file:
        command_id = response["Command"]["CommandId"]
        print(f"{command_id=}", file=summary_file)

        waiter = client.get_waiter("command_executed")
        try:
            waiter.wait(
                CommandId=command_id,
                InstanceId=EC2_INSTANCE_ID,
                WaiterConfig={"Delay": 5, "MaxAttempts": 10}
            )
        except Exception as e:
            print(f"error: {e}", file=summary_file)
            raise
        finally:
            output = client.get_command_invocation(
                CommandId=command_id,
                InstanceId=EC2_INSTANCE_ID,
            )

            print("\n# Execute Results\n", file=summary_file)
            print(output["StandardOutputContent"], file=summary_file)

            if output["StandardErrorContent"]:
                print("\n# Error Logs\n", file=summary_file)
                print("```\n", file=summary_file)
                print(output["StandardErrorContent"], file=summary_file)
                print("\n```\n", file=summary_file)

if __name__ == "__main__":
    main()
