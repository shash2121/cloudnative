variable "kafka_cluster_name" {
    type = string
    default = "us-east-1"
}
variable "kafka_version" {
  default = "3.5.1"
}
variable "broker_nodes" {
  default = 1
}
variable "kafka_instance_type" {
  default = "kafka.t3.small"
}
variable "kafka_volume_size" {
  default = 20
}
variable "kafka_subnets" {
  type = list
}