// Azure deployment template for CogniGrid electrical grid dashboard
// This template deploys a Node.js web application to Azure App Service

@description('The name of the App Service resource')
param appServiceName string = 'cognigrid-${uniqueString(resourceGroup().id)}'

@description('Location for all resources')
param location string = resourceGroup().location

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
    na  {
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
output apimGatewayUrl string = apimService.properties.gatewayUrl
output apimDeveloperPortalUrl string = apimService.properties.developerPortalUrl
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDatabaseName string = postgresDatabaseName
output deploymentInstructions string = 'Access your app via APIM at: ${apimService.properties.gatewayUrl}'
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
      me: 'Standard_B1ms'
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
