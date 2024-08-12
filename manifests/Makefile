MANIFESTS = zookeeper.yaml kafka.yaml mongo.yaml redis.yaml nodeapp.yaml

DEPLOY_ORDER = zookeeper.yaml kafka.yaml mongo.yaml redis.yaml nodeapp.yaml

all: $(DEPLOY_ORDER)

apply:
	for manifest in $(DEPLOY_ORDER); do \
		echo "Applying $$manifest..."; \
		kubectl apply -f $$manifest; \
	done

clean:
	for manifest in $(DEPLOY_ORDER); do \
		echo "Deleting $$manifest..."; \
		kubectl delete -f $$manifest; \
	done

.PHONY: all apply clean
