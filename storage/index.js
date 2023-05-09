const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient } = require("@azure/storage-blob");
const { v1: uuidv1 } = require("uuid");
require("dotenv").config();



async function main() {
  try {
    console.log("Azure Blob storage v12 - JavaScript quickstart sample");
      const STORAGE_CONNECTION_STRING = process.env.STORAGE_CONNECTION_STRING
      // 없을시 err
      if (!STORAGE_CONNECTION_STRING) {
        throw Error('Azure Storage Connection string not found');
      }
    const blobServiceClient = new BlobServiceClient(
      'https;AccountName=svlimestorage;AccountKey=sqGVn7jbXQCVA7iUHuQda2U/cV6i32+TRK6+gvlYCtrnEFqyJaV1rhqoFGCFqz8/lkGqKLFpoYP1+AStpHiqAg==;EndpointSuffix=core.windows.net',
      DefaultAzureCredential
    ); 
    // Quick start code goes here
    const containerName = `newcontainer${new Date().getTime()}`;
    const blockBlobName = 'lime-contents' + uuidv1();
    const containerClient = blobServiceClient.getContainerClient(containerName);
    // 현재 존재하는 컨테이너 주소  읽기
    const blockBlobClient = containerClient.getBlockBlobClient(blockBlobName);
    console.log(`find container ${blockBlobName} successfully`, blockBlobClient.requestId);
  
    const createContainerResponse = await containerClient.create();
    console.log(`Create container ${containerName} successfully`, createContainerResponse.requestId);
  
    // blob 이름
    const blobName = 'test' + uuidv1() + '.txt';
  
    
    // blob의 이름과 url
    console.log(
      `\nUploading to Azure storage as blob\n\tname: ${blobName}:\n\tURL: ${blockBlobClient.url}`
    );
  
    // blob에 업로드할 값
    const data = 'Hello, World';
    const uploadBlobResponse = await blockBlobClient.upload(data, data.length);
    console.log(
      `Blob was uploaded successfully. requestId: ${uploadBlobResponse.requestId}`
    );


  } catch (err) {
    console.error(`Error: ${err}`);
  }
}

main()
  .then(() => console.log("Done"))
  .catch((ex) => console.log(ex.message));