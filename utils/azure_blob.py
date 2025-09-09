import os
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
import uuid

load_dotenv()

AZURE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_CONTAINER_NAME = os.getenv("AZURE_CONTAINER_NAME")

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)

def upload_file_to_azure(file_obj, filename):
    unique_filename = f"{uuid.uuid4()}_{filename}"
    blob_client = container_client.get_blob_client(unique_filename)
    blob_client.upload_blob(file_obj, overwrite=True)
    return unique_filename  # Save this as bucket_path in your DB

def download_file_from_azure(bucket_path):
    blob_service_client = BlobServiceClient.from_connection_string(os.getenv("AZURE_STORAGE_CONNECTION_STRING"))
    container_client = blob_service_client.get_container_client(os.getenv("AZURE_CONTAINER_NAME"))
    blob_client = container_client.get_blob_client(bucket_path)
    stream = blob_client.download_blob()
    return stream.readall()