package notification

import (
	"bufio"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

type SMTPSender struct {
	config SMTPConfig
}

func NewSMTPSender(config SMTPConfig) *SMTPSender {
	return &SMTPSender{config: config}
}

func (sender *SMTPSender) Send(ctx context.Context, recipient, subject, body string) error {
	if strings.ContainsAny(recipient+subject+sender.config.From, "\r\n") {
		return fmt.Errorf("email header contains a newline")
	}
	address := net.JoinHostPort(sender.config.Host, sender.config.Port)
	connection, err := (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("connect SMTP: %w", err)
	}
	defer connection.Close()
	if deadline, ok := ctx.Deadline(); ok {
		_ = connection.SetDeadline(deadline)
	}

	client, err := smtp.NewClient(connection, sender.config.Host)
	if err != nil {
		return fmt.Errorf("create SMTP client: %w", err)
	}
	defer client.Close()
	if ok, _ := client.Extension("STARTTLS"); !ok {
		return fmt.Errorf("SMTP server does not support STARTTLS")
	}
	if err := client.StartTLS(&tls.Config{ServerName: sender.config.Host, MinVersion: tls.VersionTLS12}); err != nil {
		return fmt.Errorf("start SMTP TLS: %w", err)
	}
	if sender.config.Username != "" {
		auth := smtp.PlainAuth("", sender.config.Username, sender.config.Password, sender.config.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("authenticate SMTP: %w", err)
		}
	}
	fromEnvelope := sender.config.From
	fromHeader := sender.config.From
	if strings.Contains(sender.config.From, "<") && strings.Contains(sender.config.From, ">") {
		start := strings.Index(sender.config.From, "<")
		end := strings.Index(sender.config.From, ">")
		if start < end {
			fromEnvelope = strings.TrimSpace(sender.config.From[start+1 : end])
		}
	} else if sender.config.From != "" {
		fromHeader = fmt.Sprintf("CreatorOS <%s>", sender.config.From)
	}

	if err := client.Mail(fromEnvelope); err != nil {
		return fmt.Errorf("set SMTP sender: %w", err)
	}
	if err := client.Rcpt(recipient); err != nil {
		return fmt.Errorf("set SMTP recipient: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("open SMTP body: %w", err)
	}

	contentType := "text/plain; charset=UTF-8"
	if strings.Contains(body, "<html") || strings.Contains(body, "<!DOCTYPE") {
		contentType = "text/html; charset=UTF-8"
	}

	message := "From: " + fromHeader + "\r\n" +
		"To: " + recipient + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\nContent-Type: " + contentType + "\r\n\r\n" + body
	buffer := bufio.NewWriter(writer)
	if _, err := buffer.WriteString(message); err != nil {
		_ = writer.Close()
		return fmt.Errorf("write SMTP body: %w", err)
	}
	if err := buffer.Flush(); err != nil {
		_ = writer.Close()
		return fmt.Errorf("flush SMTP body: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("close SMTP body: %w", err)
	}
	if err := client.Quit(); err != nil {
		return fmt.Errorf("finish SMTP transaction: %w", err)
	}
	return nil
}
