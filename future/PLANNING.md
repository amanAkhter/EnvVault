I am planning to build a cli tool that can be used to manage multiple environments : 

Means the invited persons in the organization will have their own environments public private keys handling, based on their public private key the can fetch the env variables from the cloud. 

1. It should be a mono repo with the following tools: 
- frontend : react 
- backend : firebase
- cli : "cli" this directory will contain the cli tool and will be used to manage the environments.

The cli tool should have the following features: 
- login 
- admin create environment {name}: this will create a new environment with the given name and will be stored in the cloud.
- admin delete environment : this will delete the environment from the cloud and from the local.
- admin update environment {name}: this will update the environment in the cloud and from the local.
- admin add user to environment {env_name} {user_email}: this will add the user to the environment and will generate a new public private key pair for the user.
- admin remove user from environment {env_name} {user_email}: this will remove the user from the environment and will delete the public private key pair for the user.
- admin list users in environment {env_name}: this will list all the users that are available in the environment.
- list environments : this will list all the environments that are available in the cloud.
- fetch {env_name} : this will update the local env with the sync from the cloud one : make it so that local file gets synced with the cloud one, if not synced for 24 hours it will get invalidated and the user will have to fetch the environment again. (if a user is marked as inactive this command should not work)
- admin push {env_name} : this will update the cloud env with the sync from the local one 
- logout : this will log out the user from the cli tool 
- whoami : this will show the current user that is logged in 

: All the admin related and normal user related env handling can be done using the cli and the public private key user and admin added to their account 

NOTE : the main issue is when a user logs is marked as inactive he/she shouldn't be able to fetch or push the env and the latest envs should be with the user and if the user is active the env should be fetched and pushed based on the latest sync time.

think and act like senior engineer and product designer and analyse the complete application and codebase and create a IMPROVEMENT.nopush.md file with all the imporvements and enhancements which can be done to the paplication along with all the above mentioned features
also create a PLAN.nopush.md with the plan to implement those and make it SaaS and production grade