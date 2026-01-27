// Azure deployment template for CogniGrid electrical grid dashboard
// This template deploys a Node.js web application to Azure App Service

@description('The name of the App Service resource')
param appServiceName string = 'cognigrid-${uniqueString(resourceGroup().id)}'

@description('Location for all resources (default Sweden East)')
param location string = 'swedeneast'

@description('The pricing tier for the App Service Plan')
@allowed([
  'F1'  // Free
  'B1'  // Basic
  'S1'  // Standard
  'P1v2'  // Premium v2
])
param appServicePlanSku string = 'B1'

@description('Node.js version')
param nodeVersion string = '18-lts'

@description('Azure AI Foundry (Cognitive Services) account name')
param aiAccountName string = 'cognigrid-ai-${uniqueString(resourceGroup().id)}'

@description('Azure AI account SKU name (OpenAI uses S0)')
@allowed([
  'S0'
])
param aiSkuName string = 'S0'

@description('Azure AI account kind')
@allowed([
  'OpenAI'
])
param aiKind string = 'OpenAI'

@description('Azure AI account location (defaults to deployment location)')
param aiLocation string = location

@description('IoT Hub name')
param iotHubName string = 'cognigrid-iothub-${uniqueString(resourceGroup().id)}'

@description('IoT Hub SKU name')
@allowed([
  'F1'
  'S1'
  'S2'
  'S3'
])
param iotHubSkuName string = 'S1'

@description('IoT Hub units (capacity)')
param iotHubUnits int = 1

@description('IoT Hub partitions for built-in endpoint')
param iotHubPartitions int = 4

@description('IoT Hub retention days for built-in endpoint')
param iotHubRetentionDays int = 1

@description('Stream Analytics job name')
param streamJobName string = 'cognigrid-sa-${uniqueString(resourceGroup().id)}'

@description('Stream Analytics streaming units')
param asaStreamingUnits int = 1

@description('IoT Hub consumer group name for ASA input')
param iotConsumerGroupName string = 'asa-consumer'

@description('Storage account name for ASA outputs (lowercase, 3-24 chars)')
param saName string = 'cognigridst${toLower(uniqueString(resourceGroup().id))}'

@description('Blob container name for ASA outputs')
param saContainerName string = 'stream'

@description('PostgreSQL administrator login name')
param postgresAdminLogin string = 'cognigridadmin'

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('PostgreSQL database name')
param postgresDatabaseName string = 'cognigriddb'

@description('API Management service name')
param apimServiceName string = 'cognigrid-apim-${uniqueString(resourceGroup().id)}'

@description('API Management publisher email')
param apimPublisherEmail string

@description('API Management publisher name')
param apimPublisherName string = 'CogniGrid Operations'

@description('API Management SKU')
@allowed([
  'Consumption'
  'Developer'
  'Basic'
  'Standard'
  'Premium'
])
param apimSku string = 'Consumption'

// PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: '${appServiceName}-postgres'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '15'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// PostgreSQL Database
resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgresServer
  name: postgresDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// PostgreSQL Firewall Rule - Allow Azure Services
resource postgresFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// API Management Service
resource apimService 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: apimServiceName
  location: location
  sku: {
    name: apimSku
    capacity: apimSku == 'Consumption' ? 0 : 1
  }
  properties: {
    publisherEmail: apimPublisherEmail
    publisherName: apimPublisherName
  }
}

// API Management Backend
resource apimBackend 'Microsoft.ApiManagement/service/backends@2023-05-01-preview' = {
  parent: apimService
  name: 'cognigrid-backend'
  properties: {
    description: 'CogniGrid App Service Backend'
    url: 'https://${webApp.properties.defaultHostName}'
    protocol: 'http'
  }
}

// API Management API
resource apimApi 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apimService
  name: 'cognigrid-api'
  properties: {
    displayName: 'CogniGrid Operations API'
    path: ''
    protocols: [
      'https'
    ]
    subscriptionRequired: false
    serviceUrl: 'https://${webApp.properties.defaultHostName}'
  }
}

// API Management Policy - Forward all requests to backend
resource apimApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: apimApi
  name: 'policy'
  properties: {
    value: '''
      <policies>
        <inbound>
          <base />
          <set-backend-service backend-id="cognigrid-backend" />
          <cors allow-credentials="true">
            <allowed-origins>
              <origin>*</origin>
            </allowed-origins>
            <allowed-methods>
              <method>*</method>
            </allowed-methods>
            <allowed-headers>
              <header>*</header>
            </allowed-headers>
          </cors>
        </inbound>
        <backend>
          <base />
        </backend>
        <outbound>
          <base />
        </outbound>
        <on-error>
          <base />
        </on-error>
      </policies>
    '''
    format: 'xml'
  }
}

// Azure AI Foundry (Azure OpenAI) Account
resource aiAccount 'Microsoft.CognitiveServices/accounts@2025-09-01' = {
  name: aiAccountName
  location: aiLocation
  kind: aiKind
  sku: {
    name: aiSkuName
    tier: 'Standard'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
    allowProjectManagement: true
  }
}

// IoT Hub
resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: iotHubName
  location: location
  sku: {
    name: iotHubSkuName
    capacity: iotHubUnits
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    eventHubEndpoints: {
      events: {
        partitionCount: iotHubPartitions
        retentionTimeInDays: iotHubRetentionDays
      }
    }
    authorizationPolicies: [
      {
        keyName: 'service'
        rights: 'ServiceConnect'
      }
    ]
  }
}

// Existing child to retrieve keys for the 'service' policy
resource iotHubServiceKey 'Microsoft.Devices/IotHubs/IotHubKeys@2023-06-30' existing = {
  parent: iotHub
  name: 'service'
}

// Build IoT Hub service connection string
var iotHubConnectionString = 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=service;SharedAccessKey=${iotHubServiceKey.listKeys().primaryKey}'

// Storage Account for Stream Analytics output
resource sa 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: saName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}

// Blob container for ASA output
resource saBlobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${sa.name}/default/${saContainerName}'
  properties: {
    publicAccess: 'None'
  }
}

// Stream Analytics Job
resource streamJob 'Microsoft.StreamAnalytics/streamingjobs@2020-03-01' = {
  name: streamJobName
  location: location
  properties: {
    sku: {
      name: 'Standard'
    }
    compatibilityLevel: '1.2'
    dataLocale: 'en-US'
    outputErrorPolicy: 'Drop'
    eventsOutOfOrderPolicy: 'Adjust'
    eventsOutOfOrderMaxDelayInSeconds: 0
    transformation: {
      name: 'DefaultTransformation'
      properties: {
        streamingUnits: asaStreamingUnits
        query: 'SELECT * INTO [blobOutput] FROM [iotInput]'
      }
    }
    inputs: [
      {
        name: 'iotInput'
        properties: {
          type: 'Stream'
          serialization: {
            type: 'Json'
            properties: {
              encoding: 'UTF8'
            }
          }
          datasource: {
            type: 'Microsoft.Devices/IotHubs'
            properties: {
              iotHubNamespace: iotHub.properties.hostName
              sharedAccessPolicyName: 'service'
              sharedAccessPolicyKey: iotHubServiceKey.listKeys().primaryKey
              endpoint: 'messages/events'
              consumerGroupName: iotConsumerGroupName
            }
          }
        }
      }
    ]
    outputs: [
      {
        name: 'blobOutput'
        properties: {
          serialization: {
            type: 'Json'
            properties: {
              encoding: 'UTF8'
              format: 'LineSeparated'
            }
          }
          datasource: {
            type: 'Microsoft.Storage/Blob'
            properties: {
              container: saContainerName
              pathPattern: 'asa/{date}/{time}'
              storageAccounts: [
                {
                  accountName: sa.name
                  accountKey: sa.listKeys().keys[0].value
                }
              ]
            }
          }
        }
      }
    ]
  }
}

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${appServiceName}-plan'
  location: location
  sku: {
    name: appServicePlanSku
  }
  kind: 'linux'
  properties: {
    reserved: true  // Required for Linux
  }
}

// App Service (Web App)
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: appServiceName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|${nodeVersion}'
      appSettings: [
        {
          name: 'PORT'
          value: '3000'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~${nodeVersion}'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'DATABASE_HOST'
          value: postgresServer.properties.fullyQualifiedDomainName
        }
        {
          name: 'DATABASE_NAME'
          value: postgresDatabaseName
        }
        {
          name: 'DATABASE_USER'
          value: postgresAdminLogin
        }
        {
          name: 'DATABASE_PASSWORD'
          value: postgresAdminPassword
        }
        {
          name: 'DATABASE_PORT'
          value: '5432'
        }
        {
          name: 'DATABASE_SSL'
          value: 'true'
        }
        {
          name: 'AZURE_AI_ENDPOINT'
          value: aiAccount.properties.endpoint
        }
        {
          name: 'AZURE_AI_KEY'
          value: aiAccount.listKeys().key1
        }
        {
          name: 'IOT_HUB_HOSTNAME'
          value: iotHub.properties.hostName
        }
        {
          name: 'IOT_HUB_SERVICE_CONNECTION_STRING'
          value: iotHubConnectionString
        }
      ]
      alwaysOn: appServicePlanSku != 'F1'  // Free tier doesn't support always on
      webSocketsEnabled: true  // Required for Socket.io
    }
    httpsOnly: true
  }
}

// Outputs
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output webAppName string = webApp.name
output resourceGroupName string = resourceGroup().name
output iotHubHostName string = iotHub.properties.hostName
output iotHubServiceConnectionString string = iotHubConnectionString
