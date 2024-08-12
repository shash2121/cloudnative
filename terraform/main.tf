resource "aws_msk_cluster" "kafkademo" {
  cluster_name           = var.kafka_cluster_name
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.broker_nodes

  broker_node_group_info {
    instance_type = var.kafka_instance_type
    
    client_subnets = ["subnet-xxxxxxxx", "subnet-yyyyyyyy"]
    security_groups = ["sg-xxxxxxxx"]

    storage_info {
      ebs_storage_info {
        volume_size = var.kafka_volume_size
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  tags = {
    Name        = "kafka-cluster"
    Environment = "dev"
  }
}